import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

type Condition = 'working' | 'repairable' | 'damaged' | 'scrap';
type PricingUnit = 'per_device' | 'per_kg';
interface Offer {
  id: number;
  vendor_id: number;
  vendor_name: string;
  device_type: string;
  condition: Condition;
  minimum_price_inr: number;
  maximum_price_inr: number;
  amount_inr: number;
  pricing_unit: PricingUnit;
  terms: string;
  updated_at: string;
  service_area: string;
  is_demo: number;
  distance_km: number | null;
}
interface BuybackRequest {
  id: number;
  offer_id: number | null;
  vendor_name: string;
  is_demo: number;
  device_type: string;
  condition: Condition;
  quantity: number;
  pricing_unit: PricingUnit;
  quoted_unit_price: number;
  quoted_minimum_price_inr: number;
  quoted_maximum_price_inr: number;
  quoted_terms: string;
  quoted_amount: number;
  revised_amount: number | null;
  final_agreed_amount: number | null;
  inspected_condition: Condition | null;
  inspection_notes: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  payment_reference: string | null;
  payment_confirmed_at: string | null;
  created_at: string;
  status_history: Array<{ status: string; note: string | null; updated_at: string }>;
}

const conditions: Array<{ value: Condition; label: string }> = [
  { value: 'working', label: 'Working' },
  { value: 'repairable', label: 'Repairable' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'scrap', label: 'Scrap' },
];
const money = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const priceRange = (minimum: number, maximum: number) => `${money(minimum)}–${money(maximum)}`;
const unitLabel = (unit: PricingUnit) => unit === 'per_kg' ? 'per kg' : 'per device';
const statusLabel = (status: string) => status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers },
  });
  const data = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) throw new Error(data?.message || 'The buyback action could not be completed.');
  return data as T;
}

interface Props {
  city: string;
  location: { latitude: number; longitude: number } | null;
  onOffersLoaded?: (offers: Offer[]) => void;
}

export function BuybackMarketplace({ city, location, onOffersLoaded }: Props) {
  const { toast } = useToast();
  const [deviceType, setDeviceType] = React.useState('Smartphone');
  const [condition, setCondition] = React.useState<Condition>('working');
  const [unit, setUnit] = React.useState<PricingUnit>('per_device');
  const [quantity, setQuantity] = React.useState('1');
  const [offers, setOffers] = React.useState<Offer[]>([]);
  const [requests, setRequests] = React.useState<BuybackRequest[]>([]);
  const [sortBy, setSortBy] = React.useState<'price' | 'distance'>('price');
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const [busyOfferId, setBusyOfferId] = React.useState<number | null>(null);
  const [requestsLoading, setRequestsLoading] = React.useState(true);

  const loadRequests = React.useCallback(async () => {
    setRequestsLoading(true);
    try {
      setRequests(await api<BuybackRequest[]>('/api/buyback/requests'));
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const findOffers = React.useCallback(async () => {
    if (!city) {
      setOffers([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ city, device_type: deviceType.trim(), condition, pricing_unit: unit });
      if (location) {
        params.set('latitude', String(location.latitude));
        params.set('longitude', String(location.longitude));
      }
      const matchingOffers = await api<Offer[]>(`/api/buyback/offers?${params.toString()}`);
      setOffers(matchingOffers);
      onOffersLoaded?.(matchingOffers);
    } catch (error) {
      toast({ title: 'Could not compare buyback offers', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [city, condition, deviceType, location, onOffersLoaded, toast, unit]);

  React.useEffect(() => {
    void loadRequests().catch((error: unknown) => {
      toast({ title: 'Could not load buyback requests', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    });
  }, [loadRequests, toast]);

  const sortedOffers = React.useMemo(() => [...offers].sort((left, right) => {
    if (sortBy === 'distance' && location) {
      if (left.distance_km === null && right.distance_km !== null) return 1;
      if (right.distance_km === null && left.distance_km !== null) return -1;
      if (left.distance_km !== null && right.distance_km !== null && left.distance_km !== right.distance_km) return left.distance_km - right.distance_km;
    }
    return right.maximum_price_inr - left.maximum_price_inr;
  }), [location, offers, sortBy]);
  const hasDistanceData = Boolean(location && offers.some((offer) => offer.distance_km !== null));
  const activeRequestStatuses = new Set([
    'requested',
    'offer_confirmed',
    'inspection_pending',
    'revised_offer',
    'price_accepted',
    'collected',
    'payment_pending',
  ]);
  const activeRequestOfferIds = new Set(
    requests
      .filter((request) => request.offer_id !== null && activeRequestStatuses.has(request.status))
      .map((request) => request.offer_id),
  );

  const submitRequest = async (offer: Offer) => {
    const requestedQuantity = Number(quantity);
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0 || requestedQuantity > 10_000
      || (offer.pricing_unit === 'per_device' && !Number.isSafeInteger(requestedQuantity))
      || (offer.pricing_unit === 'per_kg' && Math.round(requestedQuantity * 1000) !== requestedQuantity * 1000)) {
      toast({ title: 'Check the quantity', description: offer.pricing_unit === 'per_kg'
        ? 'Enter a weight greater than 0 and no more than 10,000 kg, up to three decimal places.'
        : 'Enter a whole-device quantity between 1 and 10,000.', variant: 'destructive' });
      return;
    }
    setBusyOfferId(offer.id);
    try {
      await api('/api/buyback/requests', {
        method: 'POST',
        body: JSON.stringify({
          offer_id: offer.id,
          quantity: requestedQuantity,
          expected_minimum_price_inr: offer.minimum_price_inr,
          expected_maximum_price_inr: offer.maximum_price_inr,
        }),
      });
      toast({ title: 'Buyback request submitted', description: 'The vendor will review the device and confirm the offer.' });
      await loadRequests();
    } catch (error) {
      await loadRequests().catch((refreshError: unknown) => {
        toast({
          title: 'Could not refresh buyback requests',
          description: refreshError instanceof Error ? refreshError.message : 'Refresh the page to check the latest request status.',
          variant: 'destructive',
        });
      });
      toast({ title: 'Could not submit buyback request', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setBusyOfferId(null);
    }
  };

  const acceptPrice = async (request: BuybackRequest) => {
    try {
      await api(`/api/buyback/requests/${request.id}/accept`, { method: 'POST' });
      toast({ title: 'Price accepted', description: 'Your acceptance has been recorded. The vendor can now arrange collection.' });
      await loadRequests();
    } catch (error) {
      toast({ title: 'Could not accept price', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const rejectPrice = async (request: BuybackRequest) => {
    try {
      await api(`/api/buyback/requests/${request.id}/reject-price`, { method: 'POST' });
      toast({ title: 'Revised price declined', description: 'The buyback request has been closed without accepting the proposed price.' });
      await loadRequests();
    } catch (error) {
      toast({ title: 'Could not decline price', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <Card id="buyback-comparison">
      <CardHeader>
        <CardTitle>Device Buyback — Sell an Eligible Device</CardTitle>
        <CardDescription>Request an estimated vendor offer to sell a device. A sale and agreed price require inspection and your approval. This action creates a buyback request only; it does not schedule a recycling pickup.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.7fr)_minmax(125px,0.55fr)_minmax(100px,0.4fr)_auto]" onSubmit={(event) => { event.preventDefault(); void findOffers(); }}>
          <div className="space-y-1"><label htmlFor="buyback-search-device" className="text-sm font-medium">Device type</label><Input id="buyback-search-device" value={deviceType} required maxLength={100} onChange={(event) => setDeviceType(event.target.value)} placeholder="e.g. Smartphone" /></div>
          <div className="space-y-1"><label htmlFor="buyback-search-condition" className="text-sm font-medium">Condition</label><select id="buyback-search-condition" value={condition} onChange={(event) => setCondition(event.target.value as Condition)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{conditions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <div className="space-y-1"><label htmlFor="buyback-search-unit" className="text-sm font-medium">Offer unit</label><select id="buyback-search-unit" value={unit} onChange={(event) => setUnit(event.target.value as PricingUnit)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="per_device">Per device</option><option value="per_kg">Per kilogram</option></select></div>
          <div className="space-y-1"><label htmlFor="buyback-search-quantity" className="text-sm font-medium">{unit === 'per_kg' ? 'Weight (kg)' : 'Quantity'}</label><Input id="buyback-search-quantity" type="number" min={unit === 'per_kg' ? '0.001' : '1'} max="10000" step={unit === 'per_kg' ? '0.001' : '1'} value={quantity} required onChange={(event) => setQuantity(event.target.value)} /></div>
          <Button type="submit" disabled={!city || loading} className="sm:self-end">{loading ? 'Comparing…' : 'Compare prices'}</Button>
        </form>
        {!city && <p className="text-sm text-muted-foreground">Choose a supported service city above to see available buyback offers.</p>}
        {city && !location && <p className="text-sm text-muted-foreground">Offers are filtered to {city}. Share your location in the recycler search to enable distance sorting when vendor coordinates are available.</p>}
        {sortedOffers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm">{sortedOffers.length} matching {sortedOffers.length === 1 ? 'offer' : 'offers'} · {deviceType} · {condition}</p>
            <label className="flex items-center gap-2 text-sm">Sort by<select value={hasDistanceData ? sortBy : 'price'} onChange={(event) => setSortBy(event.target.value as 'price' | 'distance')} className="h-9 rounded-md border bg-background px-2" disabled={!hasDistanceData}><option value="price">Highest maximum estimate</option><option value="distance">Distance</option></select></label>
          </div>
        )}
        {loading ? <p className="text-sm text-muted-foreground" role="status">Finding matching buyback offers…</p> : searched && city && offers.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">No vendors currently offer a buyback price for {condition} {deviceType.toLowerCase()} in {city}. You can still use the responsible recycling options above.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {sortedOffers.map((offer, index) => {
              const requestSubmitted = activeRequestOfferIds.has(offer.id);
              const quantityValue = Number(quantity || 0);
              const quoteMinimum = offer.minimum_price_inr * quantityValue;
              const quoteMaximum = offer.maximum_price_inr * quantityValue;
              return (
                <div key={offer.id} className="space-y-3 rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold">{offer.vendor_name}</p><p className="text-sm text-muted-foreground">{offer.service_area || city}{offer.distance_km === null ? '' : ` · Approx. ${offer.distance_km} km`}</p></div>
                    <div className="flex gap-2">{offer.is_demo === 1 && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">DEMO · Not verified</Badge>}{index === 0 && sortBy === 'price' && <Badge>Highest matching offer</Badge>}</div>
                  </div>
                  <p className="text-sm">{offer.condition} {offer.device_type}</p>
                  <p className="text-2xl font-bold text-primary">{priceRange(offer.minimum_price_inr ?? offer.amount_inr, offer.maximum_price_inr ?? offer.amount_inr)} <span className="text-sm font-normal text-muted-foreground">{unitLabel(offer.pricing_unit)}</span></p>
                  <p className="text-sm text-muted-foreground">Estimated range for {quantity || '0'} {unitLabel(offer.pricing_unit)}: <span className="font-semibold text-foreground">{priceRange(quoteMinimum, quoteMaximum)}</span></p>
                  <p className="text-xs text-muted-foreground">{offer.terms} Updated {new Date(offer.updated_at).toLocaleDateString()}.</p>
                  <Button type="button" onClick={() => void submitRequest(offer)} disabled={busyOfferId !== null || requestsLoading || requestSubmitted}>{busyOfferId === offer.id ? 'Submitting…' : requestSubmitted ? 'Request submitted' : 'Request this offer'}</Button>
                </div>
              );
            })}
          </div>
        )}
        <section className="space-y-3 border-t pt-5" aria-labelledby="my-buyback-requests">
          <div><h3 id="my-buyback-requests" className="font-semibold">My Buyback Requests</h3><p className="text-sm text-muted-foreground">Track vendor confirmation, inspection, your price acceptance, collection, and payment status.</p></div>
          {requests.length === 0 ? <p className="text-sm text-muted-foreground">You have no buyback requests.</p> : requests.map((request) => {
            const priceToAccept = request.status === 'revised_offer' ? request.revised_amount : null;
            return (
              <div key={request.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-medium">{request.device_type} · Requested {request.condition} · {request.vendor_name}{request.is_demo === 1 ? ' (DEMO)' : ''}</p><p className="text-sm text-muted-foreground">{request.service_area || 'Service area not listed'} · Estimated range: {priceRange(request.quoted_minimum_price_inr ?? request.quoted_unit_price, request.quoted_maximum_price_inr ?? request.quoted_unit_price)} {unitLabel(request.pricing_unit)} · {request.quantity} {unitLabel(request.pricing_unit)} · Quoted maximum total {money(request.quoted_amount)}</p><p className="text-sm">Request status: {statusLabel(request.status)}</p>
                    {request.inspected_condition && <p className="mt-1 text-sm">Vendor Inspection: {statusLabel(request.inspected_condition)}{request.inspection_notes ? ` · ${request.inspection_notes}` : ''}</p>}
                    {request.revised_amount !== null && <p className="text-sm text-amber-700">Final Price Approval: vendor proposed {money(request.revised_amount)} total; awaiting your decision.</p>}
                    {request.final_agreed_amount !== null && <p className="text-sm font-medium">Agreed final amount: {money(request.final_agreed_amount)}</p>}
                    <p className="text-sm text-muted-foreground">Payment Tracking: {statusLabel(request.payment_status)}{request.payment_method ? ` · ${statusLabel(request.payment_method)}` : ''}{request.payment_confirmed_at ? ` · ${new Date(request.payment_confirmed_at).toLocaleString()}` : ''}{request.payment_reference ? ` · Ref ${request.payment_reference}` : ''}</p>
                    <p className="text-xs text-muted-foreground">{request.quoted_terms}</p>
                  </div>
                  <Badge variant="outline">{statusLabel(request.status)}</Badge>
                </div>
                {request.status_history.length > 0 && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Request history</summary><ol className="mt-2 space-y-1 border-l pl-3">{request.status_history.map((entry, index) => <li key={`${entry.updated_at}-${index}`}><span className="font-medium text-foreground">{statusLabel(entry.status)}</span> · {new Date(entry.updated_at).toLocaleString()}{entry.note ? ` — ${entry.note}` : ''}</li>)}</ol></details>}
                {priceToAccept !== null && <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => void acceptPrice(request)}>Accept final price ({money(priceToAccept)})</Button><Button type="button" variant="outline" onClick={() => void rejectPrice(request)}>Decline final price</Button></div>}
              </div>
            );
          })}
        </section>
      </CardContent>
    </Card>
  );
}
