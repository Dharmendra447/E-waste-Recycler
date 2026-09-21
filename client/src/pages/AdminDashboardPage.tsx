import * as React from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { VendorManagement } from '@/features/admin/VendorManagement';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

interface Overview { totalUsers: number; totalVendors: number; totalPickups: number; completedRecycling: number; totalEwasteDivertedKg: number; }

export function AdminDashboardPage() {
  const { session } = useAuth();
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [campaign, setCampaign] = React.useState({ name: '', target_kg: '', start_date: '', end_date: '' });
  const { toast } = useToast();

  React.useEffect(() => {
    fetch('/api/admin/overview', { credentials: 'include' }).then((response) => response.ok ? response.json() : null).then(setOverview);
  }, []);

  const createCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch('/api/admin/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ...campaign, target_kg: Number(campaign.target_kg) }) });
    if (!response.ok) { toast({ title: 'Could not create campaign', variant: 'destructive' }); return; }
    setCampaign({ name: '', target_kg: '', start_date: '', end_date: '' });
    toast({ title: 'Campaign created' });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {session?.name}. Platform overview and vendor management.</p>
      </div>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[
        ['Total Users', overview?.totalUsers ?? '...'], ['Total Vendors', overview?.totalVendors ?? '...'], ['Pickup Requests', overview?.totalPickups ?? '...'], ['Completed Recycling', overview?.completedRecycling ?? '...'], ['E-waste Diverted', `${overview?.totalEwasteDivertedKg ?? '...'} kg`],
      ].map(([label, value]) => <Card key={label}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></CardContent></Card>)}</section>
      <VendorManagement />
      <Card className="mt-8"><CardContent className="pt-6"><h2 className="text-xl font-semibold">Create Collection Campaign</h2><form onSubmit={createCampaign} className="mt-4 grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="campaign-name">Campaign name</Label><Input id="campaign-name" value={campaign.name} onChange={(event) => setCampaign({ ...campaign, name: event.target.value })} placeholder="Campus E-Waste Drive 2026" required /></div><div className="space-y-2"><Label htmlFor="campaign-target">Goal (kg)</Label><Input id="campaign-target" type="number" min="1" value={campaign.target_kg} onChange={(event) => setCampaign({ ...campaign, target_kg: event.target.value })} required /></div><div /><div className="space-y-2"><Label htmlFor="campaign-start">Start date</Label><Input id="campaign-start" type="date" value={campaign.start_date} onChange={(event) => setCampaign({ ...campaign, start_date: event.target.value })} required /></div><div className="space-y-2"><Label htmlFor="campaign-end">End date</Label><Input id="campaign-end" type="date" value={campaign.end_date} onChange={(event) => setCampaign({ ...campaign, end_date: event.target.value })} required /></div><Button type="submit" className="sm:col-span-2">Create campaign</Button></form></CardContent></Card>
    </div>
  );
}