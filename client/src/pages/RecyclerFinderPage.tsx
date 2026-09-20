import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Phone, Recycle, LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PickupForm } from '@/features/pickups/PickupForm';
import { useToast } from '@/components/ui/use-toast';
import type { Recycler } from '@/types';

export function RecyclerFinderPage() {
  const [searchParams] = useSearchParams();
  const [category, setCategory] = React.useState(searchParams.get('category') || '');
  const deviceType = searchParams.get('deviceType') || '';
  const condition = searchParams.get('condition') || '';
  const hazard = searchParams.get('hazard') || '';
  const [recyclers, setRecyclers] = React.useState<Recycler[]>([]);
  const [selectedRecycler, setSelectedRecycler] = React.useState<Recycler | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [location, setLocation] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const { toast } = useToast();

  const fetchRecyclers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({ category, hazard });
      if (location) { query.set('latitude', String(location.latitude)); query.set('longitude', String(location.longitude)); }
      const response = await fetch(`/api/recyclers?${query.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Could not load recyclers.');
      setRecyclers(await response.json());
    } catch (error) {
      toast({ title: 'Could not load recyclers', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [category, hazard, location, toast]);

  React.useEffect(() => { fetchRecyclers(); }, [fetchRecyclers]);

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div><h1 className="text-3xl font-bold">Find a Recycler</h1><p className="text-muted-foreground">Choose a local collection centre that accepts your e-waste.</p></div>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row"><Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Search by category, e.g. batteries" /><Button variant="outline" onClick={fetchRecyclers}>Search</Button><Button variant="outline" onClick={() => navigator.geolocation?.getCurrentPosition((position) => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }))}><LocateFixed className="mr-2 h-4 w-4" />Use my location</Button></div>
          {isLoading ? <p className="text-muted-foreground">Finding suitable recyclers...</p> : recyclers.length === 0 ? <Card><CardContent className="pt-6 text-muted-foreground">No active recyclers match this category.</CardContent></Card> : recyclers.map((recycler) => <Card key={recycler.id}><CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle>{recycler.name}</CardTitle><CardDescription className="mt-1"><MapPin className="mr-1 inline h-4 w-4" />{recycler.distanceKm === null || recycler.distanceKm === undefined ? 'Distance unavailable' : `${recycler.distanceKm} km away`} · {recycler.address || recycler.city || 'Location not provided'}</CardDescription></div><Badge variant="default">Active</Badge></div></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">Match: {recycler.matchScore || 0}%</Badge>{recycler.specialHandling && <Badge variant="outline">Special handling</Badge>}</div><div className="text-sm text-muted-foreground"><p><Recycle className="mr-1 inline h-4 w-4" />Accepts: {recycler.accepted_categories || 'Electronic waste'}</p><p><Phone className="mr-1 inline h-4 w-4" />{recycler.email}</p><p className="mt-1 text-xs">Match score uses category compatibility, hazard capability, and proximity where available.</p></div><Button onClick={() => setSelectedRecycler(recycler)}>Schedule pickup</Button></CardContent></Card>)}
        </section>
        <aside>{selectedRecycler ? <PickupForm selectedRecycler={selectedRecycler} initialCategory={category} initialDeviceType={deviceType} initialCondition={condition} initialHazard={hazard} onPickupRequested={() => setSelectedRecycler(null)} /> : <Card><CardHeader><CardTitle>Ready to recycle?</CardTitle><CardDescription>Select a recycler to open the pickup request form.</CardDescription></CardHeader><CardContent><Button asChild className="w-full"><Link to="/dashboard">View your pickup history</Link></Button></CardContent></Card>}</aside>
      </div>
    </div>
  );
}