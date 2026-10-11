import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

type Condition = 'working' | 'repairable' | 'damaged' | 'scrap';
type PricingUnit = 'per_device' | 'per_kg';
interface BuybackOffer {
  id: number;
  device_type: string;
  condition: Condition;
  minimum_price_inr: number;
  maximum_price_inr: number;
  amount_inr: number;
  pricing_unit: PricingUnit;
  active: number;
  terms: string;
  updated_at: string;
}
interface BuybackRequest {
  id: number;
  device_type: string;
  condition: Condition;
  quantity: number;
  pricing_unit: PricingUnit;
  quoted_unit_price: number;
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
  status_history: Array<{ status: string; note: string | null; updated_at: string }>;
}

const conditions: Array<{ value: Condition; label: string }> = [
  { value: 'working', label: 'Working' },
  { value: 'repairable', label: 'Repairable' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'scrap', label: 'Scrap' },
];
const deviceTypes = [
  'Smartphone',
  'Tablet',
  'Laptop',
  'Desktop Computer',
  'Monitor',
  'Keyboard and Mouse',
  'Printer',
  'Circuit Board',
  'Chargers and Cables',
  'Batteries',
  'Other Electronics',
];
const money = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const priceRange = (minimum: number, maximum: number) => `${money(minimum)}–${money(maximum)}`;
const unitLabel = (unit: PricingUnit) => unit === 'per_kg' ? 'per kg' : 'per device';
type PriceRangeInputs = Record<string, { minimum: string; maximum: string }>;
type RequestDraft = { inspected_condition: Condition; inspection_notes: string; revised_amount: string; payment_method: 'cash' | 'upi' | 'bank_transfer' | 'other'; payment_reference: string };
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

export function BuybackPricingPanel() {
  const { toast } = useToast();
  const [enabled, setEnabled] = React.useState(false);
  const [offers, setOffers] = React.useState<BuybackOffer[]>([]);
  const [requests, setRequests] = React.useState<BuybackRequest[]>([]);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [selectedDeviceTypes, setSelectedDeviceTypes] = React.useState<string[]>(['Smartphone']);
  const [deviceSearch, setDeviceSearch] = React.useState('');
  const [priceRanges, setPriceRanges] = React.useState<PriceRangeInputs>({ Smartphone: { minimum: '0', maximum: '' } });
  const [condition, setCondition] = React.useState<Condition>('working');
  const [amount, setAmount] = React.useState('');
  const [unit, setUnit] = React.useState<PricingUnit>('per_device');
  const [terms, setTerms] = React.useState('Final price subject to device inspection and your approval.');
  const [busy, setBusy] = React.useState(false);
  const [requestDrafts, setRequestDrafts] = React.useState<Record<number, RequestDraft>>({});

  const requestDraft = (request: BuybackRequest): RequestDraft => requestDrafts[request.id] ?? {
    inspected_condition: request.inspected_condition ?? request.condition,
    inspection_notes: request.inspection_notes ?? '',
    revised_amount: request.revised_amount === null ? '' : String(request.revised_amount),
    payment_method: request.payment_method === 'upi' || request.payment_method === 'bank_transfer' || request.payment_method === 'other' ? request.payment_method : 'cash',
    payment_reference: request.payment_reference ?? '',
  };
  const updateRequestDraft = (request: BuybackRequest, update: Partial<RequestDraft>) => {
    setRequestDrafts((current) => ({ ...current, [request.id]: { ...requestDraft(request), ...update } }));
  };

  const load = React.useCallback(async () => {
    try {
      const [settings, nextOffers, nextRequests] = await Promise.all([
        api<{ buyback_enabled: boolean }>('/api/vendor/buyback/settings'),
        api<BuybackOffer[]>('/api/vendor/buyback/offers'),
        api<BuybackRequest[]>('/api/vendor/buyback/requests'),
      ]);
      setEnabled(settings.buyback_enabled);
      setOffers(nextOffers);
      setRequests(nextRequests);
    } catch (error) {
      toast({ title: 'Could not load buyback pricing', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  }, [toast]);

  React.useEffect(() => { void load(); }, [load]);

  const clearEditor = () => {
    setEditingId(null);
    setSelectedDeviceTypes(['Smartphone']);
    setDeviceSearch('');
    setPriceRanges({ Smartphone: { minimum: '0', maximum: '' } });
    setCondition('working');
    setAmount('');
    setUnit('per_device');
    setTerms('Final price subject to device inspection and your approval.');
  };

  const saveOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedDeviceTypes.length === 0) {
      toast({ title: 'Select a device type', description: 'Choose at least one device type for this offer.', variant: 'destructive' });
      return;
    }
    const entries = selectedDeviceTypes.map((deviceType) => ({
      device_type: deviceType,
      minimum_price_inr: Number(priceRanges[deviceType]?.minimum),
      maximum_price_inr: Number(priceRanges[deviceType]?.maximum),
    }));
    const invalidRange = entries.find(({ minimum_price_inr: minimum, maximum_price_inr: maximum }) => (
      !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum < 0 || maximum < minimum || maximum > 10_000_000
      || Math.round(minimum * 100) !== minimum * 100 || Math.round(maximum * 100) !== maximum * 100
    ));
    if (invalidRange) {
      toast({ title: 'Check the price range', description: `Enter valid minimum and maximum prices for ${invalidRange.device_type}; maximum must be at least minimum.`, variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await api(`/api/vendor/buyback/offers/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ ...entries[0], condition, pricing_unit: unit, terms, active: true }),
        });
      } else {
        await api('/api/vendor/buyback/offers', {
          method: 'POST',
          body: JSON.stringify({ device_types: entries, condition, pricing_unit: unit, terms, active: true }),
        });
      }
      toast({ title: editingId ? 'Buyback offer updated' : 'Buyback offers added' });
      clearEditor();
      await load();
    } catch (error) {
      toast({ title: 'Could not save offer', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const editOffer = (offer: BuybackOffer) => {
    setEditingId(offer.id);
    setSelectedDeviceTypes([offer.device_type]);
    setPriceRanges({ [offer.device_type]: { minimum: String(offer.minimum_price_inr ?? offer.amount_inr), maximum: String(offer.maximum_price_inr ?? offer.amount_inr) } });
    setCondition(offer.condition);
    setUnit(offer.pricing_unit);
    setTerms(offer.terms);
  };

  const setRange = (deviceType: string, field: 'minimum' | 'maximum', value: string) => {
    setPriceRanges((current) => ({
      ...current,
      [deviceType]: { minimum: current[deviceType]?.minimum ?? '0', maximum: current[deviceType]?.maximum ?? '', [field]: value },
    }));
  };

  const toggleDeviceType = (deviceType: string, checked: boolean) => {
    setSelectedDeviceTypes((current) => checked
      ? current.includes(deviceType) ? current : [...current, deviceType]
      : current.filter((selected) => selected !== deviceType));
    if (checked && !priceRanges[deviceType]) setRange(deviceType, 'minimum', '0');
  };

  const deactivateOffer = async (offer: BuybackOffer) => {
    try {
      await api(`/api/vendor/buyback/offers/${offer.id}`, { method: 'DELETE' });
      toast({ title: 'Offer removed' });
      await load();
    } catch (error) {
      toast({ title: 'Could not deactivate offer', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const requestAction = async (request: BuybackRequest, action: string) => {
    try {
      const draft = requestDraft(request);
      if (action === 'revise' && (draft.revised_amount.trim() === '' || !Number.isFinite(Number(draft.revised_amount)))) {
        toast({ title: 'Enter the proposed final amount', description: 'A valid inspection-based total price is required.', variant: 'destructive' });
        return;
      }
      await api(`/api/vendor/buyback/requests/${request.id}/action`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          ...(action === 'revise' ? {
            revised_amount: Number(draft.revised_amount),
            inspected_condition: draft.inspected_condition,
            inspection_notes: draft.inspection_notes,
          } : {}),
          ...(action === 'paid' ? {
            payment_method: draft.payment_method,
            payment_reference: draft.payment_reference,
          } : {}),
        }),
      });
      toast({ title: action === 'revise' ? 'Inspection and final price recorded' : action === 'paid' ? 'Payment recorded as paid' : 'Buyback request updated' });
      await load();
    } catch (error) {
      toast({ title: 'Could not update request', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Device Buyback Pricing</CardTitle>
          <CardDescription>Set the prices you offer to purchase devices. These are your offers, not guaranteed market prices; final amounts require inspection and user acceptance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={enabled} onChange={async (event) => {
              const next = event.target.checked;
              try {
                await api('/api/vendor/buyback/settings', { method: 'PUT', body: JSON.stringify({ buyback_enabled: next }) });
                setEnabled(next);
              } catch (error) {
                toast({ title: 'Could not update buyback availability', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
              }
            }} />
            <span>I am currently buying eligible used electronics<p className="mt-1 text-xs font-normal text-muted-foreground">Your active offers appear in user comparisons only while this is enabled.</p></span>
          </label>
          {!enabled && offers.some((offer) => offer.active === 1) && <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">You have active offers, but users cannot see or request them while buyback availability is turned off.</p>}
          <form onSubmit={saveOffer} className="space-y-4 rounded-lg border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="buyback-device-search">Device types</label>
                <Input id="buyback-device-search" value={deviceSearch} maxLength={100} onChange={(event) => setDeviceSearch(event.target.value)} placeholder="Search device types" disabled={Boolean(editingId)} />
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2" role="group" aria-label="Choose buyback device types">
                  {deviceTypes.filter((item) => item.toLowerCase().includes(deviceSearch.trim().toLowerCase())).map((item) => (
                    <label key={item} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                      <input type="checkbox" checked={selectedDeviceTypes.includes(item)} disabled={Boolean(editingId)} onChange={(event) => toggleDeviceType(item, event.target.checked)} />
                      {item}
                    </label>
                  ))}
                  {deviceTypes.every((item) => !item.toLowerCase().includes(deviceSearch.trim().toLowerCase())) && <p className="px-2 py-1 text-sm text-muted-foreground">No device types match.</p>}
                </div>
                <p className="text-xs text-muted-foreground">Each selected device is saved as its own editable offer with a separate price range.</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1"><label className="text-sm font-medium" htmlFor="buyback-condition">Accepted condition</label><select id="buyback-condition" value={condition} onChange={(event) => setCondition(event.target.value as Condition)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{conditions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
                <div className="space-y-1"><label className="text-sm font-medium" htmlFor="buyback-unit">Pricing unit</label><select id="buyback-unit" value={unit} onChange={(event) => setUnit(event.target.value as PricingUnit)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="per_device">Per device</option><option value="per_kg">Per kilogram</option></select></div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedDeviceTypes.map((item) => <span key={item} className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-xs">{item}<button type="button" className="rounded-full px-1 font-bold hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Remove ${item}`} disabled={Boolean(editingId)} onClick={() => toggleDeviceType(item, false)}>×</button></span>)}
              {selectedDeviceTypes.length === 0 && <p className="text-sm text-destructive">Select at least one device type.</p>}
            </div>
            {selectedDeviceTypes.map((item, index) => (
              <fieldset key={item} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <legend className="px-1 text-sm font-medium">{item} price range</legend>
                <div className="space-y-1"><label className="text-xs font-medium" htmlFor={`buyback-minimum-${index}`}>Minimum Price (₹)</label><Input id={`buyback-minimum-${index}`} type="number" min="0" max="10000000" step="0.01" value={priceRanges[item]?.minimum ?? '0'} required onChange={(event) => setRange(item, 'minimum', event.target.value)} /></div>
                <div className="space-y-1"><label className="text-xs font-medium" htmlFor={`buyback-maximum-${index}`}>Maximum Price (₹)</label><Input id={`buyback-maximum-${index}`} type="number" min="0" max="10000000" step="0.01" value={priceRanges[item]?.maximum ?? ''} required onChange={(event) => setRange(item, 'maximum', event.target.value)} /></div>
                <p className="self-end pb-2 text-xs text-muted-foreground">{unitLabel(unit)}</p>
              </fieldset>
            ))}
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><div className="space-y-1"><label className="text-sm font-medium" htmlFor="buyback-terms">Inspection / final-price conditions</label><Input id="buyback-terms" value={terms} maxLength={300} onChange={(event) => setTerms(event.target.value)} /></div><div className="flex items-end gap-2"><Button type="submit" disabled={busy || selectedDeviceTypes.length === 0}>{editingId ? 'Save changes' : 'Add offers'}</Button>{editingId && <Button type="button" variant="outline" onClick={clearEditor}>Cancel</Button>}</div></div>
          </form>
          <div className="space-y-3">
            {offers.length === 0 ? <p className="text-sm text-muted-foreground">No buyback offers yet. Add a device, condition, and price to get started.</p> : offers.map((offer) => (
              <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{offer.device_type} · {offer.condition}</p><Badge variant={offer.active ? 'default' : 'outline'}>{offer.active ? 'Active' : 'Inactive'}</Badge></div><p className="text-sm text-muted-foreground">{priceRange(offer.minimum_price_inr ?? offer.amount_inr, offer.maximum_price_inr ?? offer.amount_inr)} {unitLabel(offer.pricing_unit)} · Updated {new Date(offer.updated_at).toLocaleDateString()}</p><p className="text-xs text-muted-foreground">{offer.terms}</p></div>
                <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => editOffer(offer)}>Edit</Button>{offer.active === 1 && <Button type="button" size="sm" variant="outline" onClick={() => void deactivateOffer(offer)}>Remove</Button>}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Device Buyback Requests</CardTitle><CardDescription>Complete Vendor Inspection and Final Price Approval. Record payment only after it has actually been made; this is payment record-keeping, not a payment gateway.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 ? <p className="text-sm text-muted-foreground">No buyback requests yet.</p> : requests.map((request) => (
            <div key={request.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{request.device_type} · Requested condition: {statusLabel(request.condition)}</p><p className="text-sm text-muted-foreground">{request.quantity} {unitLabel(request.pricing_unit)} · Estimated range total: {money(request.quoted_amount)} · Status: {statusLabel(request.status)}</p>{request.inspected_condition && <p className="text-sm">Inspected condition: {statusLabel(request.inspected_condition)}{request.inspection_notes ? ` · ${request.inspection_notes}` : ''}</p>}{request.revised_amount !== null && <p className="text-sm text-amber-700">Final price proposal: {money(request.revised_amount)} total · awaiting user acceptance</p>}{request.final_agreed_amount !== null && <p className="text-sm font-medium">Agreed amount: {money(request.final_agreed_amount)}</p>}<p className="text-sm text-muted-foreground">Payment tracking: {statusLabel(request.payment_status)}{request.payment_method ? ` · ${statusLabel(request.payment_method)}` : ''}{request.payment_confirmed_at ? ` · ${new Date(request.payment_confirmed_at).toLocaleString()}` : ''}{request.payment_reference ? ` · Ref ${request.payment_reference}` : ''}</p></div><Badge variant="outline">Payment: {statusLabel(request.payment_status)}</Badge></div>
              {request.status === 'inspection_pending' && (
                <fieldset className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
                  <legend className="px-1 text-sm font-medium">Vendor Inspection & Final Price Approval</legend>
                  <label className="space-y-1 text-sm">Actual device condition<select value={requestDraft(request).inspected_condition} onChange={(event) => updateRequestDraft(request, { inspected_condition: event.target.value as Condition })} className="h-10 w-full rounded-md border bg-background px-3"><option value="working">Working</option><option value="repairable">Repairable</option><option value="damaged">Damaged</option><option value="scrap">Scrap</option></select></label>
                  <label className="space-y-1 text-sm">Proposed final total (₹)<Input type="number" min="0" max="1000000000" step="0.01" value={requestDraft(request).revised_amount} onChange={(event) => updateRequestDraft(request, { revised_amount: event.target.value })} /></label>
                  <label className="space-y-1 text-sm sm:col-span-2">Inspection notes (optional)<Input maxLength={500} value={requestDraft(request).inspection_notes} onChange={(event) => updateRequestDraft(request, { inspection_notes: event.target.value })} /></label>
                </fieldset>
              )}
              {request.status === 'payment_pending' && (
                <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <label className="space-y-1 text-sm">Payment method used<select value={requestDraft(request).payment_method} onChange={(event) => updateRequestDraft(request, { payment_method: event.target.value as RequestDraft['payment_method'] })} className="h-10 w-full rounded-md border bg-background px-3"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label>
                  <label className="space-y-1 text-sm">Payment reference (optional)<Input maxLength={100} value={requestDraft(request).payment_reference} onChange={(event) => updateRequestDraft(request, { payment_reference: event.target.value })} placeholder="Transaction/reference ID only" /></label>
                </div>
              )}
              {request.status_history.length > 0 && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Request history</summary><ol className="mt-2 space-y-1 border-l pl-3">{request.status_history.map((entry, index) => <li key={`${entry.updated_at}-${index}`}><span className="font-medium text-foreground">{statusLabel(entry.status)}</span> · {new Date(entry.updated_at).toLocaleString()}{entry.note ? ` — ${entry.note}` : ''}</li>)}</ol></details>}
              <div className="flex flex-wrap gap-2">
                {request.status === 'requested' && <Button size="sm" onClick={() => void requestAction(request, 'confirm')}>Confirm offer</Button>}
                {request.status === 'offer_confirmed' && <Button size="sm" onClick={() => void requestAction(request, 'inspect')}>Start inspection</Button>}
                {(request.status === 'requested' || request.status === 'offer_confirmed' || request.status === 'inspection_pending' || request.status === 'revised_offer') && <Button size="sm" variant="outline" onClick={() => void requestAction(request, 'reject')}>Reject</Button>}
                {request.status === 'inspection_pending' && <Button size="sm" onClick={() => void requestAction(request, 'revise')}>Record inspection & propose final price</Button>}
                {request.status === 'price_accepted' && <Button size="sm" onClick={() => void requestAction(request, 'collect')}>Mark collected</Button>}
                {request.status === 'collected' && <Button size="sm" onClick={() => void requestAction(request, 'payment_pending')}>Mark payment pending</Button>}
                {request.status === 'payment_pending' && <Button size="sm" onClick={() => void requestAction(request, 'paid')}>Confirm payment was made</Button>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
