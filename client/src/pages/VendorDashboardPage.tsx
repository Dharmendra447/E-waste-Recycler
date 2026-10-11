import * as React from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PickupList } from '@/features/pickups/PickupList';
import { VendorCapacityPanel } from '@/features/pickups/VendorCapacityPanel';
import { BuybackPricingPanel } from '@/features/pickups/BuybackPricingPanel';
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
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8 sm:py-10">
      <div>
        <p className="mb-2 text-sm font-semibold text-primary">Recycler workspace</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Vendor Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">Welcome, {session?.name}. Manage requests through collection and recycling.</p>
      </div>
      <section aria-label="Pickup overview" className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">{stats.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex min-h-28 items-center justify-between gap-3 p-4 sm:p-5"><div><p className="text-xs text-muted-foreground sm:text-sm">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span></CardContent></Card>)}</section>
      <VendorCapacityPanel />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-4">
          <TabsTrigger value="available">Recycling Pickup Requests</TabsTrigger>
          <TabsTrigger value="assigned">My Recycling Pickups</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="buyback">Buyback Pricing</TabsTrigger>
        </TabsList>
        <TabsContent value="available"><PickupList key="available" filter="available" /></TabsContent>
        <TabsContent value="assigned"><PickupList key="assigned" filter="assigned" /></TabsContent>
        <TabsContent value="inventory"><PickupList key="inventory" filter="inventory" /></TabsContent>
        <TabsContent value="buyback"><BuybackPricingPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
