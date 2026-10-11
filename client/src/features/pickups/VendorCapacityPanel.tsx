import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import type { VendorSettings } from '@/types';
import { recyclingCategories } from '../../../../shared/recycling-categories';

const emptySettings: VendorSettings = {
  accepted_categories: '',
  accepting_pickups: true,
  pickup_capacity: null,
  active_quantity: 0,
};

export function VendorCapacityPanel() {
  const [settings, setSettings] = React.useState<VendorSettings>(emptySettings);
  const [categories, setCategories] = React.useState('');
  const [capacity, setCapacity] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();

  const loadSettings = React.useCallback(async () => {
    try {
      const response = await fetch('/api/vendor/settings', { credentials: 'include' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Could not load vendor settings.');
      const nextSettings = data as VendorSettings;
      setSettings(nextSettings);
      setCategories(nextSettings.accepted_categories || '');
      setCapacity(nextSettings.pickup_capacity === null ? '' : String(nextSettings.pickup_capacity));
    } catch (error) {
      toast({
        title: 'Settings unavailable',
        description: error instanceof Error ? error.message : 'Could not load vendor settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { void loadSettings(); }, [loadSettings]);

  const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch('/api/vendor/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          accepted_categories: categories,
          pickup_capacity: capacity === '' ? null : Number(capacity),
          accepting_pickups: settings.accepting_pickups,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Could not save vendor settings.');
      setSettings(data as VendorSettings);
      toast({ title: 'Vendor settings saved' });
    } catch (error) {
      toast({
        title: 'Could not save settings',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const capacityProgress = settings.pickup_capacity
    ? Math.min(100, (settings.active_quantity / settings.pickup_capacity) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capacity &amp; inventory</CardTitle>
        <CardDescription>Set accepted categories, availability, and active item capacity. Received pickups remain visible in Inventory.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Open pickup items</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {settings.active_quantity}{settings.pickup_capacity === null ? ' active · no capacity limit' : ` of ${settings.pickup_capacity} capacity`}
              </p>
            </div>
            <span className="text-xl font-bold">{settings.pickup_capacity === null ? '—' : Math.max(0, settings.pickup_capacity - settings.active_quantity)}</span>
          </div>
          {settings.pickup_capacity !== null && <Progress className="mt-3" value={capacityProgress} />}
        </div>

        <form onSubmit={saveSettings} className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
            <div>
              <Label htmlFor="vendor-pickup-availability" className="font-semibold">Accepting new pickups</Label>
              <p className="mt-1 text-xs text-muted-foreground">Unavailable vendors are hidden from recycler search.</p>
            </div>
            <Switch
              id="vendor-pickup-availability"
              checked={settings.accepting_pickups}
              onCheckedChange={(accepting_pickups) => setSettings((current) => ({ ...current, accepting_pickups }))}
              disabled={isLoading || isSaving}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor-categories">Supported categories</Label>
              <Input id="vendor-categories" list="vendor-category-options" value={categories} onChange={(event) => setCategories(event.target.value)} placeholder="Laptops, Batteries" maxLength={500} disabled={isLoading || isSaving} />
              <datalist id="vendor-category-options">{recyclingCategories.map((category) => <option key={category} value={category} />)}<option value="IT Equipment" /></datalist>
              <p className="text-xs text-muted-foreground">Separate supported categories with commas. Common aliases such as Laptop/Laptops and Mobile Phone/SmartPhone are saved as one category.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-capacity">Maximum active item quantity</Label>
              <Input id="vendor-capacity" type="number" min="1" max="10000" step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="No limit" disabled={isLoading || isSaving} />
              <p className="text-xs text-muted-foreground">Leave blank for no capacity limit.</p>
            </div>
          </div>
          <Button type="submit" disabled={isLoading || isSaving}>
            {isLoading ? 'Loading settings...' : isSaving ? 'Saving...' : 'Save capacity & availability'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
