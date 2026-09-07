import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/AuthContext';
import { MapPin } from 'lucide-react';

interface PickupFormProps {
  onPickupRequested: () => void;
}

export function PickupForm({ onPickupRequested }: PickupFormProps) {
  const { toast } = useToast();
  const { session, refreshSession } = useAuth();
  const [address, setAddress] = React.useState('');
  const [itemsDescription, setItemsDescription] = React.useState('');
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
          latitude: location?.latitude,
          longitude: location?.longitude,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit pickup request');
      }

      toast({
        title: 'Success!',
        description: 'Your pickup request has been submitted. You earned 10 points!',
      });

      // Clear form
      setAddress('');
      setItemsDescription('');
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
              <Textarea id="items" value={itemsDescription} onChange={(e) => setItemsDescription(e.target.value)} placeholder="e.g., 2 laptops, 1 old monitor" required />
            </div>
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
