import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';

interface Vendor {
  id: number;
  name: string;
  email: string;
  city: string;
  address: string;
}

export function VendorManagement() {
  const [vendors, setVendors] = React.useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchVendors = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/vendors', {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch vendors');
        }
        const data = await response.json();
        setVendors(data);
      } catch (err) {
        toast({ title: "Error", description: "Could not fetch vendors.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchVendors();
  }, [toast]);

  if (isLoading) {
    return <p>Loading vendors...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Management</CardTitle>
        <CardDescription>View and manage all registered vendors.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell>{vendor.id}</TableCell>
                <TableCell className="font-medium">{vendor.name}</TableCell>
                <TableCell>{vendor.email}</TableCell>
                <TableCell>{vendor.city}</TableCell>
                <TableCell>{vendor.address}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}