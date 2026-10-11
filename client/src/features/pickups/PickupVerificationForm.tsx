import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

interface PickupVerificationFormProps {
  pickupId: number;
  onVerified: () => void;
}

const conditionOptions = [
  { value: 'working', label: 'Working' },
  { value: 'partially_working', label: 'Partially working' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'non_functional', label: 'Non-functional' },
] as const;

export function PickupVerificationForm({ pickupId, onVerified }: PickupVerificationFormProps) {
  const [deviceType, setDeviceType] = React.useState('');
  const [quantity, setQuantity] = React.useState('1');
  const [condition, setCondition] = React.useState<(typeof conditionOptions)[number]['value']>('working');
  const [damageNotes, setDamageNotes] = React.useState('');
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append('actual_device_type', deviceType.trim());
    formData.append('quantity', quantity);
    formData.append('condition', condition);
    formData.append('damage_notes', damageNotes.trim());
    if (photo) formData.append('photo', photo);

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/vendor/pickups/${pickupId}/verification`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'Could not verify this pickup.');
      }
      toast({ title: 'Pickup verified', description: 'Verification recorded and pickup marked collected.' });
      onVerified();
    } catch (error) {
      toast({
        title: 'Verification unavailable',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div>
        <h3 className="font-semibold">Verify collected items</h3>
        <p className="mt-1 text-sm text-muted-foreground">Confirm the received device condition before marking this pickup collected.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`actual-device-${pickupId}`}>Actual device type</Label>
          <Input id={`actual-device-${pickupId}`} value={deviceType} onChange={(event) => setDeviceType(event.target.value)} maxLength={120} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`actual-quantity-${pickupId}`}>Actual quantity</Label>
          <Input id={`actual-quantity-${pickupId}`} type="number" min="1" max="10000" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`actual-condition-${pickupId}`}>Condition</Label>
          <select
            id={`actual-condition-${pickupId}`}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={condition}
            onChange={(event) => setCondition(event.target.value as (typeof conditionOptions)[number]['value'])}
          >
            {conditionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`damage-notes-${pickupId}`}>Damage notes</Label>
          <Textarea id={`damage-notes-${pickupId}`} value={damageNotes} onChange={(event) => setDamageNotes(event.target.value)} maxLength={2000} placeholder="Describe any visible damage or handling concerns" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`collection-photo-${pickupId}`}>Collection photo (optional)</Label>
          <Input id={`collection-photo-${pickupId}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
          <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP; maximum 10 MB.</p>
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving verification...' : 'Verify and mark collected'}
      </Button>
    </form>
  );
}
