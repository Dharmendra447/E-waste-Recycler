import * as React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Award, Leaf, Recycle, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { PickupList } from '@/features/pickups/PickupList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { EcoImpact, RecyclingActivity } from '@/types';
import { CampaignList } from '@/features/campaigns/CampaignList';

const emptyImpact: EcoImpact = { devices: 0, landfillKg: 0, co2Kg: 0, points: 0, completedPickups: 0 };
const emptyActivity: RecyclingActivity = { devicesAnalyzed: 0, pickupsRequested: 0, itemsRecycled: 0, rewardPoints: 0, estimatedEwasteDivertedKg: 0, recentActivity: [] };

export function DashboardPage() {
  const { session } = useAuth();
  const [impact, setImpact] = React.useState<EcoImpact>(emptyImpact);
  const [activity, setActivity] = React.useState<RecyclingActivity>(emptyActivity);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchImpact = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/impact', { credentials: 'include' });
      if (response.ok) setImpact(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchActivity = React.useCallback(async () => {
    const response = await fetch('/api/activity', { credentials: 'include' });
    if (response.ok) setActivity(await response.json());
  }, []);

  React.useEffect(() => {
    fetchImpact();
    fetchActivity();
    const refreshTimer = window.setInterval(fetchImpact, 10000);
    const activityTimer = window.setInterval(fetchActivity, 10000);
    return () => { window.clearInterval(refreshTimer); window.clearInterval(activityTimer); };
  }, [fetchImpact, fetchActivity]);

  const summary = [
    { label: 'Devices analyzed', value: activity.devicesAnalyzed, icon: Sparkles },
    { label: 'Pickups requested', value: activity.pickupsRequested, icon: Activity },
    { label: 'Items recycled', value: activity.itemsRecycled, icon: Recycle },
    { label: 'Reward points', value: activity.rewardPoints, icon: Award },
    { label: 'Estimated e-waste diverted', value: `${activity.estimatedEwasteDivertedKg} kg`, icon: Leaf },
  ];

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-primary">EcoCycle AI</p><h1 className="text-3xl font-bold">Welcome, {session?.name}</h1><p className="text-muted-foreground">Continue your recycling journey from analysis to impact.</p></div><Button asChild><Link to="/ai-detection"><Sparkles className="mr-2 h-4 w-4" />Start Recycling</Link></Button></div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{summary.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between pt-6"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{isLoading ? '...' : value}</p></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>)}</section>
      <section className="space-y-4"><div><h2 className="text-2xl font-bold">Quick Actions</h2><p className="text-muted-foreground">Choose the next step in your recycling journey.</p></div><div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Analyze E-Waste</CardTitle></CardHeader><CardContent><Button asChild className="w-full"><Link to="/ai-detection">Upload an item</Link></Button></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" />Find Recycler</CardTitle></CardHeader><CardContent><Button asChild variant="outline" className="w-full"><Link to="/find-recycler">Browse suitable centres</Link></Button></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Leaf className="h-5 w-5 text-primary" />Ask EcoAI</CardTitle></CardHeader><CardContent><Button asChild variant="outline" className="w-full"><Link to="/ecoai-advisor">Get recycling advice</Link></Button></CardContent></Card></div></section>
      <section className="space-y-4"><div><h2 className="text-2xl font-bold">Recent Recycling Activity</h2><p className="text-muted-foreground">Track every request through collection and recycling.</p></div><PickupList /></section>
      <section className="space-y-4"><div><h2 className="text-2xl font-bold">Recent Activity</h2><p className="text-muted-foreground">Your recorded analyses and pickup milestones.</p></div><Card><CardContent className="pt-6">{activity.recentActivity.length === 0 ? <p className="text-muted-foreground">No recycling activity yet.</p> : <div className="space-y-4">{activity.recentActivity.map((entry, index) => <div key={`${entry.occurredAt}-${index}`} className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"><div><p className="font-medium">{entry.type}</p><p className="text-sm text-muted-foreground">{entry.detail}</p></div><time className="shrink-0 text-sm text-muted-foreground">{new Date(entry.occurredAt).toLocaleDateString()}</time></div>)}</div>}</CardContent></Card></section>
      <section className="space-y-4"><div><h2 className="text-2xl font-bold">E-Waste Collection Campaigns</h2><p className="text-muted-foreground">Contribute a completed recycling pickup to an active community drive.</p></div><CampaignList /></section>
      <section className="space-y-4"><div><h2 className="text-2xl font-bold">Environmental Impact</h2><p className="text-muted-foreground">Estimated environmental impact based on completed recycling.</p></div><Card><CardContent className="grid gap-4 pt-6 sm:grid-cols-2"><div><p className="text-sm text-muted-foreground">Estimated landfill diversion</p><p className="text-xl font-semibold">{impact.landfillKg} kg</p></div><div><p className="text-sm text-muted-foreground">Estimated CO2 savings</p><p className="text-xl font-semibold">{impact.co2Kg} kg</p></div></CardContent></Card></section>
    </div>
  );
}

