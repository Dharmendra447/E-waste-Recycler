import * as React from 'react';
import { PickupMap } from '@/components/PickupMap';
import { useAuth } from '@/features/auth/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PickupList } from '@/features/pickups/PickupList';


export function VendorDashboardPage() {
  const { vendor } = useAuth();
  // We pass a key to PickupList to force a re-render when the tab changes
  const [activeTab, setActiveTab] = React.useState("available");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {vendor?.name}! Manage pickups here.</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="available">Available Pickups</TabsTrigger>
              <TabsTrigger value="assigned">My Pickups</TabsTrigger>
              <TabsTrigger value="map">Map View</TabsTrigger>
          </TabsList>
          <TabsContent value="available">
            <PickupList key="available" filter="available" />
          </TabsContent>
          <TabsContent value="assigned">
            <PickupList key="assigned" filter="assigned" />
          </TabsContent>
          <TabsContent value="map">
            <PickupMap />
          </TabsContent>
      </Tabs>
    </div>
  );
}