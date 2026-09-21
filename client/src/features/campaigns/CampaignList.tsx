import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import type { Campaign, Pickup } from '@/types';

export function CampaignList() {
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [pickups, setPickups] = React.useState<Pickup[]>([]);
  const [selectedPickup, setSelectedPickup] = React.useState<Record<number, string>>({});
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    const [campaignResponse, pickupResponse] = await Promise.all([
      fetch('/api/campaigns', { credentials: 'include' }),
      fetch('/api/pickups', { credentials: 'include' }),
    ]);
    if (campaignResponse.ok) setCampaigns(await campaignResponse.json());
    if (pickupResponse.ok) setPickups(await pickupResponse.json());
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const participate = async (campaignId: number) => {
    const pickupId = Number(selectedPickup[campaignId]);
    const response = await fetch(`/api/campaigns/${campaignId}/participate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ pickup_id: pickupId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      toast({ title: 'Participation unavailable', description: data?.message || 'Choose a recycled pickup.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Participation recorded', description: `${data.amountKg} kg added from your recycled pickup.` });
    load();
  };

  const recycledPickups = pickups.filter((pickup) => pickup.status === 'recycled');
  if (campaigns.length === 0) return <Card><CardContent className="pt-6 text-muted-foreground">No active collection campaigns yet.</CardContent></Card>;

  return <div className="grid gap-4 md:grid-cols-2">{campaigns.map((campaign) => {
    const alreadyJoined = new Set(campaign.joinedPickupIds);
    const availablePickups = recycledPickups.filter((pickup) => !alreadyJoined.has(pickup.id));
    return <Card key={campaign.id}><CardHeader><CardTitle>{campaign.name}</CardTitle><CardDescription>{campaign.start_date} to {campaign.end_date}</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex justify-between text-sm"><span>Collected: {campaign.collectedKg} kg</span><span>Goal: {campaign.target_kg} kg</span></div><Progress value={campaign.progressPercent} /><p className="text-sm text-muted-foreground">{campaign.participants} participant{campaign.participants === 1 ? '' : 's'} · {campaign.progressPercent}% complete</p>{availablePickups.length > 0 ? <div className="space-y-2"><Select value={selectedPickup[campaign.id] || ''} onValueChange={(value) => setSelectedPickup((current) => ({ ...current, [campaign.id]: value }))}><SelectTrigger><SelectValue placeholder="Select a recycled pickup" /></SelectTrigger><SelectContent>{availablePickups.map((pickup) => <SelectItem key={pickup.id} value={String(pickup.id)}>{pickup.items_description}</SelectItem>)}</SelectContent></Select><Button className="w-full" onClick={() => participate(campaign.id)} disabled={!selectedPickup[campaign.id]}>Participate</Button></div> : <p className="text-sm text-muted-foreground">Recycle an item through your pickup history to participate.</p>}</CardContent></Card>;
  })}</div>;
}
