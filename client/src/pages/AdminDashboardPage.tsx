import * as React from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { VendorManagement } from '@/features/admin/VendorManagement';

export function AdminDashboardPage() {
  const { admin } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {admin?.name}!</p>
      </div>
      <VendorManagement />
    </div>
  );
}