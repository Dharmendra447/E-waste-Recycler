import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Pickup } from '@/types';
import { useAuth } from '../auth/AuthContext';
import { Download, Printer } from 'lucide-react';

interface PickupListProps {
  filter?: 'user' | 'available' | 'assigned';
}

const statuses = ['requested', 'accepted', 'scheduled', 'collected', 'recycled'];
const trackingStatuses = ['requested', 'confirmed', 'assigned', 'scheduled', 'collected', 'processing', 'recycled'];
const trackingLabels: Record<string, string> = { requested: 'Requested', confirmed: 'Confirmed', accepted: 'Confirmed', assigned: 'Recycler Assigned', scheduled: 'Pickup Scheduled', collected: 'Picked Up', processing: 'Processing', recycled: 'Recycled' };

export function PickupList({ filter = 'user' }: PickupListProps) {
  const [pickups, setPickups] = React.useState<Pickup[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [certificate, setCertificate] = React.useState<Record<string, string | number | boolean> | null>(null);
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
    setError(err instanceof TypeError ? 'The API server is unavailable. Start the project with npm start.' : err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [getApiEndpoint]);

  React.useEffect(() => {
    fetchPickups();
    const refreshTimer = window.setInterval(fetchPickups, 10000);
    return () => window.clearInterval(refreshTimer);
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

  const loadCertificate = async (pickupId: number) => {
    const response = await fetch(`/api/pickups/${pickupId}/certificate`, { credentials: 'include' });
    if (response.ok) setCertificate(await response.json());
    else toast({ title: 'Certificate unavailable', description: 'Certificates are available after recycling is completed.', variant: 'destructive' });
  };

  const printCertificate = () => window.print();
  const downloadCertificate = () => {
    if (!certificate) return;
    const content = Object.entries(certificate).map(([key, value]) => `${key}: ${value}`).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    link.download = `${certificate.certificateId}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (isLoading) return <p>Loading pickups...</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Pickup History</CardTitle>
        <CardDescription>
          {filter === 'available' ? 'Available pickups in your area.' : 'Your scheduled e-waste pickups.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pickups.length === 0 ? (
          <p className="text-muted-foreground">No pickup requests yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {session?.role === 'vendor' && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pickups.map((pickup) => (
                <TableRow key={pickup.id}>
                  <TableCell><div className="font-medium">{pickup.items_description}</div><div className="text-xs text-muted-foreground">{pickup.address}</div>{pickup.recyclerName && <div className="text-xs text-muted-foreground">Recycler: {pickup.recyclerName}</div>}</TableCell>
                  <TableCell>{pickup.category || 'Uncategorised'}{pickup.condition && <div className="text-xs text-muted-foreground">{pickup.condition}</div>}{pickup.hazard && <div className="text-xs text-muted-foreground">Hazard: {pickup.hazard}</div>}</TableCell>
                  <TableCell>
                    <Badge variant={pickup.status === 'recycled' || pickup.status === 'completed' ? 'default' : pickup.status === 'requested' || pickup.status === 'pending' ? 'outline' : 'secondary'}>
                      {trackingLabels[pickup.status] || pickup.status}
                    </Badge>
                    {filter === 'user' && pickup.status !== 'rejected' && <div className="mt-3 space-y-2 min-w-[190px]">{trackingStatuses.map((status, index) => <div key={status} className="flex items-center gap-2 text-xs"><span className={`h-2 w-2 rounded-full ${trackingStatuses.indexOf(pickup.status === 'accepted' ? 'confirmed' : pickup.status) >= index ? 'bg-primary' : 'bg-muted'}`} /><span className={trackingStatuses.indexOf(pickup.status === 'accepted' ? 'confirmed' : pickup.status) === index ? 'font-semibold text-primary' : 'text-muted-foreground'}>{trackingLabels[status]}</span></div>)}</div>}
                  </TableCell>
                  <TableCell>{pickup.preferred_date || new Date(pickup.requested_at).toLocaleDateString()}<div className="text-xs text-muted-foreground">{pickup.preferred_time || ''}</div><div className="mt-1 text-xs text-muted-foreground">Updated: {new Date(pickup.lastStatusUpdate || pickup.requested_at).toLocaleString()}</div></TableCell>
                  {filter === 'user' && pickup.status === 'recycled' && <TableCell><Button size="sm" variant="outline" onClick={() => loadCertificate(pickup.id)}>Certificate</Button></TableCell>}
                  {session?.role === 'vendor' && filter === 'available' && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2"><Button size="sm" onClick={() => updateStatus(pickup.id, 'confirmed')}>Confirm</Button><Button size="sm" variant="outline" onClick={() => updateStatus(pickup.id, 'rejected')}>Reject</Button></div>
                    </TableCell>
                  )}
                  {session?.role === 'vendor' && filter === 'assigned' && <TableCell className="text-right"><div className="flex flex-wrap justify-end gap-2">{pickup.status === 'confirmed' && <Button size="sm" onClick={() => updateStatus(pickup.id, 'assigned')}>Assign</Button>}{pickup.status === 'assigned' && <Button size="sm" onClick={() => updateStatus(pickup.id, 'scheduled')}>Schedule</Button>}{pickup.status === 'scheduled' && <Button size="sm" onClick={() => updateStatus(pickup.id, 'collected')}>Collected</Button>}{pickup.status === 'collected' && <Button size="sm" onClick={() => updateStatus(pickup.id, 'processing')}>Processing</Button>}{pickup.status === 'processing' && <Button size="sm" onClick={() => updateStatus(pickup.id, 'recycled')}>Recycled</Button>}</div></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    {certificate && <Card className="mt-4 border-primary/30"><CardHeader><CardTitle>Certificate of Responsible Recycling</CardTitle><CardDescription>Generated by E-Waste Recycler. This is not an official government certificate.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p><strong>Certificate ID:</strong> {certificate.certificateId}</p><p><strong>User:</strong> {certificate.userName}</p><p><strong>Device/category:</strong> {certificate.device} / {certificate.category}</p><p><strong>Recycler:</strong> {certificate.recyclerName}</p><p><strong>Recycling date:</strong> {certificate.recyclingDate}</p><p><strong>Estimated e-waste diverted:</strong> {certificate.estimatedEwasteDivertedKg} kg</p><p><strong>Status:</strong> {certificate.status}</p><div className="flex gap-2 pt-2"><Button size="sm" onClick={printCertificate}><Printer className="mr-2 h-4 w-4" />Print</Button><Button size="sm" variant="outline" onClick={downloadCertificate}><Download className="mr-2 h-4 w-4" />Download</Button></div></CardContent></Card>}
    </>
  );
}
