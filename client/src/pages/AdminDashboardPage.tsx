import * as React from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { VendorManagement } from '@/features/admin/VendorManagement';
import { Card, CardContent } from '@/components/ui/card';

interface Overview { totalUsers: number; totalVendors: number; totalPickups: number; completedRecycling: number; totalEwasteDivertedKg: number; }

export function AdminDashboardPage() {
  const { session } = useAuth();
  const [overview, setOverview] = React.useState<Overview | null>(null);

  React.useEffect(() => {
    fetch('/api/admin/overview', { credentials: 'include' }).then((response) => response.ok ? response.json() : null).then(setOverview);
  }, []);

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
    </div>
  );
}