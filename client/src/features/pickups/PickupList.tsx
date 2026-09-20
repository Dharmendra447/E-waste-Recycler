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

const statuses = ['requested', 'accepted', 'scheduled', 'collected', 'recycled'];

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

  const updateStatus = async (pickupId: number, status: string) => {
    try {
      const response = await fetch(`/api/pickups/${pickupId}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to assign pickup.');
      toast({ title: "Pickup updated", description: `Status changed to ${status}.` });
      fetchPickups(); // Refresh the list
    } catch (error) {
      toast({ title: "Error", description: "Could not update pickup.", variant: 'destructive' });
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
                <TableHead>Request</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {session?.role === 'vendor' && filter === 'available' && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pickups.map((pickup) => (
                <TableRow key={pickup.id}>
                  <TableCell><div className="font-medium">{pickup.items_description}</div><div className="text-xs text-muted-foreground">{pickup.address}</div></TableCell>
                  <TableCell>{pickup.category || 'Uncategorised'}{pickup.condition && <div className="text-xs text-muted-foreground">{pickup.condition}</div>}</TableCell>
                  <TableCell>
                    <Badge variant={pickup.status === 'recycled' || pickup.status === 'completed' ? 'default' : pickup.status === 'requested' || pickup.status === 'pending' ? 'outline' : 'secondary'}>
                      {pickup.status === 'pending' ? 'requested' : pickup.status}
                    </Badge>
                    {filter === 'user' && pickup.status !== 'rejected' && <div className="mt-2 flex flex-wrap gap-1">{statuses.map((status) => <span key={status} className={`h-1.5 w-6 rounded-full ${statuses.indexOf(status) <= statuses.indexOf(pickup.status === 'pending' ? 'requested' : pickup.status) ? 'bg-primary' : 'bg-muted'}`} title={status} />)}</div>}
                  </TableCell>
                  <TableCell>{pickup.preferred_date || new Date(pickup.requested_at).toLocaleDateString()}<div className="text-xs text-muted-foreground">{pickup.preferred_time || ''}</div></TableCell>
                  {session?.role === 'vendor' && filter === 'available' && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2"><Button size="sm" onClick={() => updateStatus(pickup.id, 'accepted')}>Accept</Button><Button size="sm" variant="outline" onClick={() => updateStatus(pickup.id, 'rejected')}>Reject</Button></div>
                    </TableCell>
                  )}
                  {session?.role === 'vendor' && filter === 'assigned' && <TableCell className="text-right"><div className="flex flex-wrap justify-end gap-2">{pickup.status === 'accepted' && <Button size="sm" onClick={() => updateStatus(pickup.id, 'scheduled')}>Schedule</Button>}{pickup.status === 'scheduled' && <Button size="sm" onClick={() => updateStatus(pickup.id, 'collected')}>Collected</Button>}{pickup.status === 'collected' && <Button size="sm" onClick={() => updateStatus(pickup.id, 'recycled')}>Recycled</Button>}</div></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
