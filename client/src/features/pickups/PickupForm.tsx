import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/AuthContext';
import { MapPin } from 'lucide-react';
import type { Recycler } from '@/types';
import { canonicalRecyclingCategory, categoryForDeviceType, recyclingCategories } from '../../../../shared/recycling-categories';

interface PickupFormProps {
  onPickupRequested: () => void;
  selectedRecycler?: Recycler | null;
  initialCategory?: string;
  initialDeviceType?: string;
  initialCondition?: string;
  initialHazard?: string;
  initialAddress?: string;
  initialLocation?: { latitude: number; longitude: number } | null;
}

async function reverseGeocode(location: { latitude: number; longitude: number }) {
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${location.latitude}&lon=${location.longitude}`);
  if (!response.ok) throw new Error('Address lookup failed.');
  const data = await response.json() as { display_name?: string };
  return data.display_name?.trim() || '';
}

export function PickupForm({ onPickupRequested, selectedRecycler, initialCategory = '', initialDeviceType = '', initialCondition = '', initialHazard = '', initialAddress = '', initialLocation = null }: PickupFormProps) {
  const { toast } = useToast();
  const { session } = useAuth();
  const [address, setAddress] = React.useState(initialAddress);
  const addressWasEdited = React.useRef(false);
  const addressAtCapturedLocation = React.useRef(initialLocation ? initialAddress.trim() : '');
  const [itemsDescription, setItemsDescription] = React.useState('');
  const [category, setCategory] = React.useState(
    categoryForDeviceType(initialDeviceType) || canonicalRecyclingCategory(initialCategory) || '',
  );
  const [condition, setCondition] = React.useState(initialCondition);
  const [hazard, setHazard] = React.useState(initialHazard);
  const [quantity, setQuantity] = React.useState('1');
  const [preferredDate, setPreferredDate] = React.useState('');
  const [preferredTime, setPreferredTime] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [location, setLocation] = React.useState<{ latitude: number; longitude: number } | null>(initialLocation);
  const [isLocating, setIsLocating] = React.useState(false);

  React.useEffect(() => {
    if (initialAddress && !addressWasEdited.current) {
      setAddress(initialAddress);
      addressAtCapturedLocation.current = initialAddress.trim();
    }
  }, [initialAddress]);

  React.useEffect(() => {
    if (initialLocation) setLocation(initialLocation);
  }, [initialLocation]);

  const handleGetLocation = async () => {
    if (location && address.trim()) return;

    const applyLocation = async (nextLocation: { latitude: number; longitude: number }) => {
      setLocation(nextLocation);
      setIsLocating(true);
      const addressBeforeLookup = address.trim();
      try {
        const resolvedAddress = await reverseGeocode(nextLocation);
        if (!addressBeforeLookup && resolvedAddress && !addressWasEdited.current) {
          setAddress(resolvedAddress);
          addressAtCapturedLocation.current = resolvedAddress;
        } else {
          addressAtCapturedLocation.current = addressBeforeLookup;
        }
        toast({
          title: 'Location fetched',
          description: addressBeforeLookup
            ? 'Coordinates captured. Your entered pickup address was kept unchanged.'
            : resolvedAddress
              ? 'Pickup address and coordinates are ready.'
              : 'Coordinates captured. Enter the pickup address manually.',
          ...(resolvedAddress || addressBeforeLookup ? {} : { variant: 'destructive' as const }),
        });
      } catch {
        addressAtCapturedLocation.current = addressBeforeLookup;
        toast({
          title: 'Address lookup unavailable',
          description: 'Coordinates were captured. Enter or confirm the pickup address manually.',
          variant: 'destructive',
        });
      } finally {
        setIsLocating(false);
      }
    };

    if (location) {
      await applyLocation(location);
      return;
    }
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation is not supported by your browser",
        variant: "destructive",
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
        await applyLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        toast({
          title: "Unable to retrieve your location",
          description: "Please enter your address manually.",
          variant: "destructive",
        });
        setIsLocating(false);
      }
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    const pickupAddress = address.trim();

    if (!pickupAddress) {
        toast({ title: 'Address is required', variant: 'destructive' });
        setIsSubmitting(false);
        return;
    }

    try {
      const response = await fetch('/api/pickups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          address: pickupAddress,
          items_description: itemsDescription,
          category,
          condition,
          hazard,
          quantity: Number(quantity),
          preferred_date: preferredDate || null,
          preferred_time: preferredTime || null,
          vendor_id: selectedRecycler?.id || null,
          notes: notes || null,
          latitude: location?.latitude,
          longitude: location?.longitude,
        }),
      });

      if (!response.ok) {
        let message = `Pickup request failed (${response.status}). Please review your details and try again.`;
        try {
          const result = await response.json() as { message?: unknown };
          if (typeof result.message === 'string' && result.message.trim()) {
            message = result.message;
          }
        } catch {
          // Keep the status-specific message when the server does not return JSON.
        }
        throw new Error(message);
      }

      toast({
        title: 'Success!',
        description: 'Your request is now waiting for a recycler to accept it.',
      });

      // Clear form
      setAddress('');
      setItemsDescription('');
      setCategory(''); setCondition(''); setHazard(''); setQuantity('1'); setPreferredDate(''); setPreferredTime(''); setNotes('');
      setLocation(null);
      
      onPickupRequested();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: error instanceof TypeError
          ? 'Could not reach the pickup service. Check your connection and try again.'
          : error instanceof Error
            ? error.message
            : 'Pickup request could not be submitted. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Recycling Pickup — Responsible Collection</CardTitle>
          <CardDescription>Request collection for responsible e-waste recycling. Payment is not guaranteed. This action creates a recycling pickup only; a buyback request is separate and optional.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={session?.name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={session?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Pickup Address</Label>
               <div className="flex items-center gap-2">
                <Input
                  id="address"
                  className="min-w-0"
                  value={address}
                  onChange={(event) => {
                    const nextAddress = event.target.value;
                    addressWasEdited.current = Boolean(nextAddress.trim());
                    setAddress(nextAddress);
                    if (location && nextAddress.trim() !== addressAtCapturedLocation.current) {
                      setLocation(null);
                    }
                  }}
                  placeholder="Enter pickup address or use your location"
                  required
                />
                <Button type="button" variant="outline" size="icon" onClick={handleGetLocation} disabled={isLocating || Boolean(location && address.trim())} title={location && address.trim() ? 'Address and location already available' : 'Get my current location'}>
                  <MapPin className="h-4 w-4" />
                  <span className="sr-only">Get my location</span>
                </Button>
              </div>
              {isLocating && <p className="text-sm text-muted-foreground animate-pulse">Getting location...</p>}
              {location && <p className="text-sm text-green-600">Location captured: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="items">E-Waste Items</Label>
              <Textarea id="items" value={itemsDescription} onChange={(e) => setItemsDescription(e.target.value)} placeholder={`e.g., 2 ${initialDeviceType || 'laptops'}, 1 old monitor`} required />
            </div>
            {selectedRecycler && <p className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm"><strong className="text-primary">Selected recycler:</strong> {selectedRecycler.name}, {selectedRecycler.city}{selectedRecycler.is_demo === 1 && <span className="mt-1 block text-amber-800">Demonstration listing only—not a real collection business. Requests are recorded for the demo and are not sent to a real recycler.</span>}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="category">Category</Label><select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" required><option value="" disabled>Choose a supported category</option>{recyclingCategories.map((supportedCategory) => <option key={supportedCategory} value={supportedCategory}>{supportedCategory}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="quantity">Quantity</Label><Input id="quantity" type="number" min="1" max="10000" step="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="condition">Condition</Label><Input id="condition" value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Working or damaged" /></div>
              <div className="space-y-2"><Label htmlFor="hazard">Hazard information</Label><Input id="hazard" value={hazard} onChange={(e) => setHazard(e.target.value)} placeholder="None detected" /></div>
              <div className="space-y-2"><Label htmlFor="date">Preferred date</Label><Input id="date" type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="time">Preferred time</Label><Input id="time" type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} required /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="notes">Notes (optional)</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access instructions or handling notes" /></div>
        </CardContent>
        <CardFooter className="px-4 pb-5 sm:px-6">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Request Pickup'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
