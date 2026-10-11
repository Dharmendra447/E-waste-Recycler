import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Pickup } from '@/types';
import { useAuth } from '../auth/AuthContext';
import { Download, MapPin, Printer } from 'lucide-react';
import { PickupVerificationForm } from '@/features/pickups/PickupVerificationForm';
import type { PickupVerification } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PickupMap = React.lazy(() =>
  import('@/features/pickups/PickupMap').then((module) => ({ default: module.PickupMap })),
);

interface PickupListProps {
  filter?: 'user' | 'available' | 'assigned' | 'inventory';
}

const trackingStatuses = ['requested', 'confirmed', 'assigned', 'scheduled', 'collected', 'processing', 'recycled'];
const trackingLabels: Record<string, string> = { requested: 'Requested', confirmed: 'Confirmed', accepted: 'Confirmed', assigned: 'Recycler Assigned', scheduled: 'Pickup Scheduled', collected: 'Picked Up', processing: 'Processing', recycled: 'Recycled' };

interface VendorPickupDetails {
  pickup: Pickup;
  verification: PickupVerification | null;
  user: { id: number; name: string; email: string };
  vendor: { id: number; name: string; city: string | null; service_area: string | null };
  statusHistory: Array<{ status: string; updated_by: number | null; updated_at: string }>;
}

export function PickupList({ filter = 'user' }: PickupListProps) {
  const [pickups, setPickups] = React.useState<Pickup[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [certificate, setCertificate] = React.useState<Record<string, string | number | boolean> | null>(null);
  const [selectedPickupId, setSelectedPickupId] = React.useState<number | null>(null);
  const [selectedPickupDetails, setSelectedPickupDetails] = React.useState<VendorPickupDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportDetails, setReportDetails] = React.useState<VendorPickupDetails | null>(null);
  const [isLoadingReport, setIsLoadingReport] = React.useState(false);
  const { session } = useAuth();
  const { toast } = useToast();

  const getApiEndpoint = React.useCallback(() => {
    if (session?.role === 'vendor') {
      if (filter === 'available') return '/api/vendor/pickups/available';
      if (filter === 'assigned') return '/api/vendor/pickups/assigned';
      if (filter === 'inventory') return '/api/vendor/pickups/inventory';
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

  const openPickupDetails = async (pickupId: number) => {
    setSelectedPickupId(pickupId);
    setSelectedPickupDetails(null);
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`/api/vendor/pickups/${pickupId}/details`, { credentials: 'include' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Could not load pickup details.');
      setSelectedPickupDetails(data as VendorPickupDetails);
    } catch (detailsError) {
      toast({
        title: 'Pickup details unavailable',
        description: detailsError instanceof Error ? detailsError.message : 'Please try again.',
        variant: 'destructive',
      });
      setSelectedPickupId(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const openPickupReport = async (pickupId: number) => {
    setReportOpen(true);
    setReportDetails(null);
    setIsLoadingReport(true);
    try {
      const response = await fetch(`/api/vendor/pickups/${pickupId}/details`, { credentials: 'include' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Could not load pickup report.');
      setReportDetails(data as VendorPickupDetails);
    } catch (reportError) {
      toast({
        title: 'Pickup report unavailable',
        description: reportError instanceof Error ? reportError.message : 'Please try again.',
        variant: 'destructive',
      });
      setReportOpen(false);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const refreshVerifiedPickup = async () => {
    await fetchPickups();
    if (selectedPickupId !== null) await openPickupDetails(selectedPickupId);
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
        <CardTitle>{filter === 'user' ? 'My Recycling Pickups' : filter === 'available' ? 'Recycling Pickup Requests' : filter === 'inventory' ? 'Recycling Inventory' : 'My Recycling Pickups'}</CardTitle>
        <CardDescription>
          {filter === 'available' ? 'Available pickups in your area.' : filter === 'inventory' ? 'Items received by your facility and their current processing status.' : 'Your scheduled e-waste pickups.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pickups.length === 0 ? (
          <p className="text-muted-foreground">No pickup requests yet.</p>
        ) : (
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {session?.role === 'vendor' && (filter === 'available' || filter === 'assigned' || filter === 'inventory') && <TableHead className="text-right">Action</TableHead>}
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
                  {session?.role === 'vendor' && filter === 'available' && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2"><Button size="sm" onClick={() => updateStatus(pickup.id, 'confirmed')}>Confirm</Button><Button size="sm" variant="outline" onClick={() => updateStatus(pickup.id, 'rejected')}>Reject</Button></div>
                    </TableCell>
                  )}
                  {session?.role === 'vendor' && filter === 'assigned' && <TableCell className="text-right"><div className="flex flex-wrap justify-end gap-2">{pickup.status === 'confirmed' && <Button size="sm" onClick={() => updateStatus(pickup.id, 'assigned')}>Assign</Button>}{pickup.status === 'assigned' && <Button size="sm" onClick={() => updateStatus(pickup.id, 'scheduled')}>Schedule</Button>}{pickup.status === 'collected' && <Button size="sm" onClick={() => updateStatus(pickup.id, 'processing')}>Processing</Button>}{pickup.status === 'processing' && <Button size="sm" onClick={() => updateStatus(pickup.id, 'recycled')}>Recycled</Button>}<Button size="sm" variant="outline" onClick={() => void openPickupDetails(pickup.id)}><MapPin className="mr-1 h-3.5 w-3.5" />Location & details</Button></div></TableCell>}
                  {session?.role === 'vendor' && filter === 'inventory' && <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => void openPickupReport(pickup.id)}>View Report</Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    <Dialog open={reportOpen} onOpenChange={setReportOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pickup Report{reportDetails ? ` · #${reportDetails.pickup.id}` : ''}</DialogTitle>
          <DialogDescription>Pickup and collection details for this assigned request.</DialogDescription>
        </DialogHeader>
        {isLoadingReport ? (
          <p className="py-6 text-sm text-muted-foreground" role="status">Loading pickup report…</p>
        ) : reportDetails ? (
          <div className="space-y-5 text-sm">
            <section className="space-y-2">
              <h3 className="font-semibold">User Information</h3>
              <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                <p><span className="text-muted-foreground">Name:</span> {reportDetails.user.name}</p>
                <p><span className="text-muted-foreground">Registered contact:</span> <a className="text-primary underline underline-offset-4" href={`mailto:${reportDetails.user.email}`}>{reportDetails.user.email}</a></p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Pickup address:</span> {reportDetails.pickup.address}</p>
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">Pickup Request</h3>
              <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                <p><span className="text-muted-foreground">Items:</span> {reportDetails.pickup.items_description}</p>
                <p><span className="text-muted-foreground">Category:</span> {reportDetails.pickup.category || 'Not provided'}</p>
                <p><span className="text-muted-foreground">Quantity:</span> {reportDetails.pickup.quantity ?? 'Not provided'}</p>
                <p><span className="text-muted-foreground">Condition:</span> {reportDetails.pickup.condition || 'Not provided'}</p>
                <p><span className="text-muted-foreground">Hazard information:</span> {reportDetails.pickup.hazard || 'None provided'}</p>
                <p><span className="text-muted-foreground">Preferred pickup:</span> {reportDetails.pickup.preferred_date || 'Not specified'} {reportDetails.pickup.preferred_time || ''}</p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Notes / handling instructions:</span> {reportDetails.pickup.notes || 'None provided'}</p>
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">Request Status</h3>
              <div className="rounded-lg border p-3">
                <p><span className="text-muted-foreground">Current status:</span> {trackingLabels[reportDetails.pickup.status] || reportDetails.pickup.status}</p>
                <p className="mt-1"><span className="text-muted-foreground">Created:</span> {new Date(reportDetails.pickup.requested_at).toLocaleString()}</p>
                <p className="mt-1"><span className="text-muted-foreground">Last updated:</span> {new Date(reportDetails.statusHistory.length
                  ? reportDetails.statusHistory[reportDetails.statusHistory.length - 1].updated_at
                  : reportDetails.pickup.lastStatusUpdate || reportDetails.pickup.requested_at).toLocaleString()}</p>
                {reportDetails.statusHistory.length > 0 && (
                  <ol className="mt-3 space-y-2 border-l pl-4">
                    {reportDetails.statusHistory.map((entry, index) => (
                      <li key={`${entry.updated_at}-${index}`} className="relative">
                        <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                        <span className="font-medium">{trackingLabels[entry.status] || entry.status}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{new Date(entry.updated_at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">Vendor Information</h3>
              <div className="rounded-lg border p-3">
                <p className="font-medium">{reportDetails.vendor.name}</p>
                <p className="text-muted-foreground">{reportDetails.vendor.service_area || reportDetails.vendor.city || 'Service area not provided'}</p>
              </div>
            </section>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {session?.role === 'vendor' && selectedPickupId !== null && (
      <section className="mt-4 space-y-4" aria-label="Selected pickup location and verification">
        {isLoadingDetails ? (
          <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading assigned pickup details...</CardContent></Card>
        ) : selectedPickupDetails ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold">Pickup #{selectedPickupDetails.pickup.id}</h3>
                <p className="text-sm text-muted-foreground">{selectedPickupDetails.pickup.items_description}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedPickupId(null); setSelectedPickupDetails(null); }}>Close</Button>
            </div>
            <React.Suspense fallback={<Card><CardContent className="p-5 text-sm text-muted-foreground">Loading pickup map...</CardContent></Card>}>
              <PickupMap pickup={selectedPickupDetails.pickup} />
            </React.Suspense>
            {selectedPickupDetails.verification ? (
              <Card>
                <CardHeader>
                  <CardTitle>Pickup verification report</CardTitle>
                  <CardDescription>Recorded {new Date(selectedPickupDetails.verification.verified_at).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                  <p><span className="text-muted-foreground">Actual device:</span> {selectedPickupDetails.verification.actual_device_type}</p>
                  <p><span className="text-muted-foreground">Actual quantity:</span> {selectedPickupDetails.verification.quantity}</p>
                  <p><span className="text-muted-foreground">Condition:</span> {selectedPickupDetails.verification.condition.replaceAll('_', ' ')}</p>
                  <p className="sm:col-span-2"><span className="text-muted-foreground">Damage notes:</span> {selectedPickupDetails.verification.damage_notes || 'None provided'}</p>
                  {selectedPickupDetails.verification.photo_data && selectedPickupDetails.verification.photo_mime && (
                    <img
                      className="max-h-72 w-full rounded-xl border border-border object-contain sm:col-span-2"
                      src={`data:${selectedPickupDetails.verification.photo_mime};base64,${selectedPickupDetails.verification.photo_data}`}
                      alt={`Collection verification for pickup ${selectedPickupDetails.pickup.id}`}
                    />
                  )}
                </CardContent>
              </Card>
            ) : selectedPickupDetails.pickup.status === 'scheduled' ? (
              <PickupVerificationForm pickupId={selectedPickupDetails.pickup.id} onVerified={() => void refreshVerifiedPickup()} />
            ) : null}
          </>
        ) : null}
      </section>
    )}
    {certificate && <Card className="mt-4 border-primary/30"><CardHeader><CardTitle>Certificate of Responsible Recycling</CardTitle><CardDescription>Generated by E-Waste Recycler. This is not an official government certificate.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p><strong>Certificate ID:</strong> {certificate.certificateId}</p><p><strong>User:</strong> {certificate.userName}</p><p><strong>Device/category:</strong> {certificate.device} / {certificate.category}</p><p><strong>Recycler:</strong> {certificate.recyclerName}</p><p><strong>Recycling date:</strong> {certificate.recyclingDate}</p><p><strong>Estimated e-waste diverted:</strong> {certificate.estimatedEwasteDivertedKg} kg</p><p><strong>Status:</strong> {certificate.status}</p><div className="flex gap-2 pt-2"><Button size="sm" onClick={printCertificate}><Printer className="mr-2 h-4 w-4" />Print</Button><Button size="sm" variant="outline" onClick={downloadCertificate}><Download className="mr-2 h-4 w-4" />Download</Button></div></CardContent></Card>}
    </>
  );
}
