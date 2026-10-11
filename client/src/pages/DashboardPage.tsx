import * as React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Leaf, Recycle, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { PickupList } from '@/features/pickups/PickupList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { RecyclingActivity } from '@/types';

const emptyActivity: RecyclingActivity = { devicesAnalyzed: 0, pickupsRequested: 0, itemsRecycled: 0, estimatedEwasteDivertedKg: 0, recentActivity: [] };

export function DashboardPage() {
  const { session } = useAuth();
  const [activity, setActivity] = React.useState<RecyclingActivity>(emptyActivity);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchActivity = React.useCallback(async () => {
    try {
      const response = await fetch('/api/activity', { credentials: 'include' });
      if (response.ok) setActivity(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchActivity();
    const activityTimer = window.setInterval(fetchActivity, 10000);
    return () => window.clearInterval(activityTimer);
  }, [fetchActivity]);

  const summary = [
    { label: 'Devices analyzed', value: activity.devicesAnalyzed, icon: Sparkles },
    { label: 'Pickups requested', value: activity.pickupsRequested, icon: Activity },
    { label: 'Items recycled', value: activity.itemsRecycled, icon: Recycle },
  ];

  return (
    <div className="container mx-auto max-w-7xl space-y-10 px-4 py-8 sm:py-10">
      <section className="flex flex-col justify-between gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Leaf className="h-3.5 w-3.5" />
            EcoCycle AI
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Welcome, {session?.name}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Continue your recycling journey from analysis to impact.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/ai-detection"><Sparkles className="h-4 w-4" />Start Recycling</Link>
        </Button>
      </section>

      <section aria-label="Recycling statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3">
        {summary.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="h-full">
            <CardContent className="flex min-h-32 items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="min-h-10 text-xs font-medium leading-5 text-muted-foreground sm:text-sm">{label}</p>
                <p className="mt-2 break-words text-xl font-bold tracking-tight sm:text-2xl">
                  {isLoading ? '...' : value}
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Quick Actions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose the next step in your recycling journey.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></span>
                Analyze E-Waste
              </CardTitle>
              <CardDescription>Identify your device and get tailored recycling guidance.</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild className="w-full"><Link to="/ai-detection">Upload an item</Link></Button>
            </CardContent>
          </Card>
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Search className="h-5 w-5" /></span>
                Find Recycler
              </CardTitle>
              <CardDescription>Explore nearby centres suited to your electronic waste.</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild variant="outline" className="w-full"><Link to="/find-recycler">Browse suitable centres</Link></Button>
            </CardContent>
          </Card>
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Leaf className="h-5 w-5" /></span>
                Ask EcoAI
              </CardTitle>
              <CardDescription>Get practical answers about safer e-waste recycling.</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild variant="outline" className="w-full"><Link to="/ecoai-advisor">Get recycling advice</Link></Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Recent Recycling Activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">Track every request through collection and recycling.</p>
        </div>
        <PickupList />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Recent Activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your recorded analyses and pickup milestones.</p>
        </div>
        <Card>
          <CardContent className="p-4 sm:p-6">
            {activity.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recycling activity yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {activity.recentActivity.map((entry, index) => (
                  <div key={`${entry.occurredAt}-${index}`} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Activity className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{entry.type}</p>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">{entry.detail}</p>
                    </div>
                    <time dateTime={entry.occurredAt} className="shrink-0 pt-0.5 text-right text-xs text-muted-foreground sm:text-sm">
                      {new Date(entry.occurredAt).toLocaleDateString()}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

    </div>
  );
}
