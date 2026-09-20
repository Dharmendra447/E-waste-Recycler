import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/AuthContext';
import { MapPin } from 'lucide-react';
import type { Recycler } from '@/types';

interface PickupFormProps {
  onPickupRequested: () => void;
  selectedRecycler?: Recycler | null;
  initialCategory?: string;
  initialDeviceType?: string;
  initialCondition?: string;
  initialHazard?: string;
}

export function PickupForm({ onPickupRequested, selectedRecycler, initialCategory = '', initialDeviceType = '', initialCondition = '', initialHazard = '' }: PickupFormProps) {
  const { toast } = useToast();
  const { session, refreshSession } = useAuth();
  const [address, setAddress] = React.useState('');
  const [itemsDescription, setItemsDescription] = React.useState('');
  const [category, setCategory] = React.useState(initialCategory);
  const [condition, setCondition] = React.useState(initialCondition);
  const [hazard, setHazard] = React.useState(initialHazard);
  const [quantity, setQuantity] = React.useState('1');
  const [preferredDate, setPreferredDate] = React.useState('');
  const [preferredTime, setPreferredTime] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [location, setLocation] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = React.useState(false);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation is not supported by your browser",
        variant: "destructive",
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        toast({
          title: "Location Fetched!",
          description: "Your current location will be used for pickup.",
        });
        setIsLocating(false);
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

    if (!address) {
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
          address,
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
        throw new Error('Failed to submit pickup request');
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
      await refreshSession(); // Refresh session to show updated points
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'There was a problem submitting your request.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
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
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Anytown, USA" required />
                <Button type="button" variant="outline" size="icon" onClick={handleGetLocation} disabled={isLocating} title="Get my current location">
                  <MapPin className="h-4 w-4" />
                  <span className="sr-only">Get my location</span>
                </Button>
              </div>
              {isLocating && <p className="text-sm text-muted-foreground animate-pulse">Getting location...</p>}
              {location && <p className="text-sm text-green-600">Location captured successfully!</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="items">E-Waste Items</Label>
              <Textarea id="items" value={itemsDescription} onChange={(e) => setItemsDescription(e.target.value)} placeholder={`e.g., 2 ${initialDeviceType || 'laptops'}, 1 old monitor`} required />
            </div>
            {selectedRecycler && <p className="rounded-md bg-primary/10 p-3 text-sm"><strong>Selected recycler:</strong> {selectedRecycler.name}, {selectedRecycler.city}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="category">Category</Label><Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="IT Equipment" required /></div>
              <div className="space-y-2"><Label htmlFor="quantity">Quantity</Label><Input id="quantity" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="condition">Condition</Label><Input id="condition" value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Working or damaged" /></div>
              <div className="space-y-2"><Label htmlFor="hazard">Hazard information</Label><Input id="hazard" value={hazard} onChange={(e) => setHazard(e.target.value)} placeholder="None detected" /></div>
              <div className="space-y-2"><Label htmlFor="date">Preferred date</Label><Input id="date" type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="time">Preferred time</Label><Input id="time" type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} required /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="notes">Notes (optional)</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access instructions or handling notes" /></div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Request Pickup'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
