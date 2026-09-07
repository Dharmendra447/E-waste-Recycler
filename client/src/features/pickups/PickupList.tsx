import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Pickup } from '@/types';
import { useAuth } from '../auth/AuthContext';

interface PickupListProps {
  filter?: 'user' | 'available' | 'assigned';
}

export function PickupList({ filter = 'user' }: PickupListProps) {
  const [pickups, setPickups] = React.useState<Pickup[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { session } = useAuth();
  const { toast } = useToast();

  const getApiEndpoint = React.useCallback(() => {
    if (session?.role === 'vendor') {
      if (filter === 'available') return '/api/vendor/pickups/available';
      if (filter === 'assigned') return '/api/vendor/pickups/assigned';
    }
    return '/api/pickups'; // Default for users
  }, [session, filter]);

  const fetchPickups = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(getApiEndpoint(), {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 401) {
          setError("You need to be logged in to see pickups.");
          return;
        }
        throw new Error('Failed to fetch pickups');
      }
      const data = await response.json();
      setPickups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [getApiEndpoint]);

  React.useEffect(() => {
    fetchPickups();
  }, [fetchPickups]);

  const handleAssign = async (pickupId: number) => {
    try {
      const response = await fetch(`/api/pickups/${pickupId}/assign`, {
        method: 'PUT',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to assign pickup.');
      toast({ title: "Success!", description: "Pickup assigned to you." });
      fetchPickups(); // Refresh the list
    } catch (error) {
      toast({ title: "Error", description: "Could not assign pickup.", variant: 'destructive' });
    }
  }

  if (isLoading) return <p>Loading pickups...</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pickup History</CardTitle>
        <CardDescription>
          {filter === 'available' ? 'Available pickups in your area.' : 'Your scheduled e-waste pickups.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pickups.length === 0 ? (
          <p className="text-muted-foreground">No pickups found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {session?.role === 'vendor' && filter === 'available' && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pickups.map((pickup) => (
                <TableRow key={pickup.id}>
                  <TableCell>{pickup.address}</TableCell>
                  <TableCell>{pickup.items_description}</TableCell>
                  <TableCell>
                    <Badge variant={pickup.status === 'completed' ? 'default' : pickup.status === 'pending' ? 'outline' : 'secondary'}>
                      {pickup.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(pickup.requested_at).toLocaleDateString()}</TableCell>
                  {session?.role === 'vendor' && filter === 'available' && (
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleAssign(pickup.id)}>Accept</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
