import * as React from 'react';
import { PickupMap } from '@/components/PickupMap';
import { useAuth } from '@/features/auth/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PickupList } from '@/features/pickups/PickupList';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, CheckCircle2, Truck, PackageCheck } from 'lucide-react';

interface VendorOverview {
  newRequests: number;
  scheduled: number;
  collected: number;
  completed: number;
}

export function VendorDashboardPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = React.useState('available');
  const [overview, setOverview] = React.useState<VendorOverview>({ newRequests: 0, scheduled: 0, collected: 0, completed: 0 });

  React.useEffect(() => {
    fetch('/api/vendor/overview', { credentials: 'include' }).then((response) => response.ok ? response.json() : null).then((data) => data && setOverview(data));
  }, [activeTab]);

  const stats = [
    { label: 'New Requests', value: overview.newRequests, icon: ClipboardList },
    { label: 'Scheduled', value: overview.scheduled, icon: Truck },
    { label: 'Collected', value: overview.collected, icon: PackageCheck },
    { label: 'Completed', value: overview.completed, icon: CheckCircle2 },
  ];

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div><p className="text-sm font-medium text-primary">Recycler workspace</p><h1 className="text-3xl font-bold">Vendor Dashboard</h1><p className="text-muted-foreground">Welcome, {session?.name}. Manage requests through collection and recycling.</p></div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between pt-6"><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>)}</section>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="available">Pickup Requests</TabsTrigger><TabsTrigger value="assigned">My Pickups</TabsTrigger><TabsTrigger value="map">Map View</TabsTrigger></TabsList>
        <TabsContent value="available"><PickupList key="available" filter="available" /></TabsContent>
        <TabsContent value="assigned"><PickupList key="assigned" filter="assigned" /></TabsContent>
        <TabsContent value="map"><PickupMap /></TabsContent>
      </Tabs>
    </div>
  );
}
