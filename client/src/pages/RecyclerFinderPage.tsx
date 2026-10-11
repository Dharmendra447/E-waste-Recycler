import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, LocateFixed, MapPin, Phone, Recycle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PickupForm } from '@/features/pickups/PickupForm';
import { PickupList } from '@/features/pickups/PickupList';
import { BuybackMarketplace } from '@/features/pickups/BuybackMarketplace';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Recycler } from '@/types';
import { canonicalRecyclingCategory, recyclingCategories } from '../../../shared/recycling-categories';

const serviceCities = [
  'Thane',
  'Mumbai',
  'Navi Mumbai',
  'Bhiwandi',
  'Kalyan',
  'Dombivli',
  'Vashi',
  'Panvel',
  'Andheri',
  'Borivali',
];
const cityAliases: Record<string, string[]> = {
  Thane: ['thane', 'thane west', 'thane east', 'thane city'],
  Mumbai: ['mumbai', 'bombay', 'greater mumbai', 'mumbai city', 'mumbai suburban'],
  'Navi Mumbai': ['navi mumbai', 'navimumbai', 'new bombay'],
  Bhiwandi: ['bhiwandi', 'bhiwandi nizampur'],
  Kalyan: ['kalyan', 'kalyan dombivli'],
  Dombivli: ['dombivli', 'dombivali', 'dombivli east', 'dombivli west'],
  Vashi: ['vashi'],
  Panvel: ['panvel', 'new panvel'],
  Andheri: ['andheri', 'andheri east', 'andheri west'],
  Borivali: ['borivali', 'borivali east', 'borivali west'],
};
function hasValidCoordinates(latitude: number | null, longitude: number | null) {
  return latitude !== null
    && longitude !== null
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90
    && Math.abs(longitude) <= 180
    && (latitude !== 0 || longitude !== 0);
}

function sameCity(left: string | null | undefined, right: string) {
  return (left || '').trim().toLowerCase() === right.trim().toLowerCase();
}

function normalizeCityName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function resolveServiceCity(address: Record<string, string | undefined>) {
  const primaryPlaceNames = [
    address.city,
    address.town,
    address.municipality,
  ].filter((place): place is string => Boolean(place));
  const secondaryPlaceNames = [
    address.city_district,
    address.suburb,
    address.village,
    address.county,
    address.state_district,
  ].filter((place): place is string => Boolean(place));
  const placeNames = [...primaryPlaceNames, ...secondaryPlaceNames];
  const normalizedPlaces = placeNames.map(normalizeCityName);
  const naviMumbaiAliases = cityAliases['Navi Mumbai'].map(normalizeCityName);
  if (normalizedPlaces.some((place) => naviMumbaiAliases.includes(place))) {
    return { city: 'Navi Mumbai', hasPlaceName: true };
  }

  for (const place of [...primaryPlaceNames, ...secondaryPlaceNames].map(normalizeCityName)) {
    for (const cityName of serviceCities) {
      if (cityName === 'Navi Mumbai') continue;
      const aliases = cityAliases[cityName].map(normalizeCityName);
      if (aliases.includes(place)) {
        return { city: cityName, hasPlaceName: true };
      }
    }
  }

  return { city: null, hasPlaceName: placeNames.length > 0 };
}

export function RecyclerFinderPage() {
  const [searchParams] = useSearchParams();
  const [activeMode, setActiveMode] = React.useState<'buyback' | 'recycling'>('buyback');
  const requestedCategory = searchParams.get('category') || '';
  const [category, setCategory] = React.useState(
    requestedCategory ? canonicalRecyclingCategory(requestedCategory) || requestedCategory : '',
  );
  const deviceType = searchParams.get('deviceType') || '';
  const condition = searchParams.get('condition') || '';
  const hazard = searchParams.get('hazard') || '';
  const [city, setCity] = React.useState(resolveServiceCity({ city: searchParams.get('city') || undefined }).city || '');
  const [recyclers, setRecyclers] = React.useState<Recycler[]>([]);
  const [selectedRecycler, setSelectedRecycler] = React.useState<Recycler | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [location, setLocation] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLabel, setLocationLabel] = React.useState('');
  const [isLocating, setIsLocating] = React.useState(false);
  const [locationMessage, setLocationMessage] = React.useState('');
  const locationRequestInProgress = React.useRef(false);
  const { toast } = useToast();
  const fetchRecyclers = React.useCallback(async () => {
    if (activeMode !== 'recycling') {
      setIsLoading(false);
      return;
    }
    if (!city) {
      setRecyclers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const query = new URLSearchParams({ category, hazard });
      if (city) query.set('city', city);
      if (location) {
        query.set('latitude', String(location.latitude));
        query.set('longitude', String(location.longitude));
      }
      const response = await fetch(`/api/recyclers?${query.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Could not load recyclers.');
      setRecyclers(await response.json());
    } catch (error) {
      toast({ title: 'Could not load recyclers', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [activeMode, category, city, hazard, location, toast]);

  React.useEffect(() => { fetchRecyclers(); }, [fetchRecyclers]);

  const handleUseLocation = () => {
    if (locationRequestInProgress.current) return;
    setLocationMessage('');
    if (!navigator.geolocation) {
      const message = 'Your browser does not support location detection. Choose a service city manually.';
      setLocationMessage(message);
      toast({ title: 'Location unavailable', description: message, variant: 'destructive' });
      return;
    }
    locationRequestInProgress.current = true;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const nextLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${nextLocation.latitude}&lon=${nextLocation.longitude}`);
        if (!response.ok) throw new Error('Reverse geocoding service returned an error.');
        const data = await response.json() as {
          display_name?: string;
          address?: Record<string, string | undefined>;
        };
        const resolution = resolveServiceCity(data.address || {});

        setLocation(nextLocation);
        setLocationLabel(data.display_name?.trim() || '');
        setSelectedRecycler(null);

        if (!resolution.city) {
          setCity('');
          const message = resolution.hasPlaceName
            ? 'Your detected location is outside Thane, Mumbai, and Navi Mumbai. Choose a supported service city manually.'
            : 'Your coordinates were found, but the city could not be determined. Choose a service city manually or try again.';
          setLocationMessage(message);
          toast({
            title: resolution.hasPlaceName ? 'Location outside service area' : 'Could not determine your city',
            description: message,
            variant: 'destructive',
          });
          return;
        }

        setCity(resolution.city);
        toast({ title: 'Location detected', description: `Showing eligible recyclers for ${resolution.city}.` });
      } catch {
        setLocation(nextLocation);
        setLocationLabel('');
        const message = 'Your coordinates were found, but the city could not be determined. Choose a service city manually or try again.';
        setLocationMessage(message);
        toast({ title: 'Could not determine your city', description: message, variant: 'destructive' });
      } finally {
        locationRequestInProgress.current = false;
        setIsLocating(false);
      }
    }, (error) => {
      const message = error.code === error.PERMISSION_DENIED
        ? 'Allow location permission or choose a service city below.'
        : error.code === error.TIMEOUT
          ? 'Location request timed out. Choose a service city or try again.'
          : 'Your location could not be determined. Choose a service city below.';
      locationRequestInProgress.current = false;
      setIsLocating(false);
      setLocationMessage(message);
      toast({ title: 'Location unavailable', description: message, variant: 'destructive' });
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  };

  const recommended = city ? recyclers.filter((recycler) => recycler.locationMatch ?? sameCity(recycler.service_area || recycler.city, city)) : [];
  const recyclerCard = (recycler: Recycler, isRecommended: boolean) => {
    const capacity = recycler.pickup_capacity;
    const availableCapacity = capacity === null || capacity === undefined
      ? null
      : Math.max(0, capacity - (recycler.active_quantity || 0));
    const coordinatesAvailable = hasValidCoordinates(recycler.latitude, recycler.longitude);
    const explanation = isRecommended
      ? category
        ? `Recommended for ${city} and ${category}.`
        : `Serves your selected area, ${city}. Choose a category to check item compatibility.`
      : `Accepts ${category || 'e-waste'} and serves ${recycler.service_area || recycler.city || 'another area'}.`;
    return (
      <Card key={recycler.id} className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-lg">{recycler.name}</CardTitle>
              <CardDescription className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span><MapPin className="mr-1 inline h-4 w-4" />{recycler.service_area || recycler.city || 'Service area not provided'}</span>
                <span aria-hidden="true">·</span>
                <span>{recycler.distanceKm === null || recycler.distanceKm === undefined ? 'Distance unavailable' : `Approx. ${recycler.distanceKm} km away`}</span>
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {recycler.is_demo === 1 && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">DEMO · Not verified</Badge>}
              {isRecommended && <Badge variant="default"><Sparkles className="mr-1 h-3 w-3" />Recommended</Badge>}
              <Badge variant="outline">{recycler.active === 1 ? 'Accepting pickups' : 'Unavailable'}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-foreground">{explanation}</p>
          {recycler.demo_description && <p className="text-sm text-muted-foreground">{recycler.demo_description}</p>}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><Recycle className="mr-1 inline h-4 w-4" /><span className="font-medium text-foreground">Accepted categories:</span> {recycler.accepted_categories || 'Electronic waste'}</p>
            <p><span className="font-medium text-foreground">Availability:</span> {availableCapacity === null ? 'Accepting requests' : `${availableCapacity} of ${capacity} item slots available`}</p>
            {recycler.is_demo !== 1 && recycler.email && <p><Phone className="mr-1 inline h-4 w-4" />{recycler.email}</p>}
            {coordinatesAvailable && (
              <a
                className="inline-flex items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={`https://www.openstreetmap.org/?mlat=${recycler.latitude}&mlon=${recycler.longitude}#map=15/${recycler.latitude}/${recycler.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Open location in OpenStreetMap <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <Button onClick={() => setSelectedRecycler(recycler)} disabled={recycler.active !== 1} className="w-full sm:w-auto">
            Select Recycler
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8 sm:py-10">
      <div>
        <p className="mb-2 text-sm font-semibold text-primary">Local collection network</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Find a Recycler</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">Choose the service you need. Device Buyback is for selling an eligible device for a price agreed after inspection; Recycling Pickup is for responsible collection, with no guaranteed payment. Each request is separate—you do not need to submit both.</p>
      </div>
      <Tabs value={activeMode} onValueChange={(value) => setActiveMode(value as 'buyback' | 'recycling')} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1 sm:max-w-2xl">
          <TabsTrigger value="buyback" className="min-h-[4.5rem] flex-col items-start gap-1 whitespace-normal px-3 py-2 text-left sm:px-5">
            <span className="font-semibold">Device Buyback</span>
            <span className="text-xs font-normal text-muted-foreground">Sell an eligible device after price approval</span>
          </TabsTrigger>
          <TabsTrigger value="recycling" className="min-h-[4.5rem] flex-col items-start gap-1 whitespace-normal px-3 py-2 text-left sm:px-5">
            <span className="font-semibold">Recycling Pickup</span>
            <span className="text-xs font-normal text-muted-foreground">Arrange responsible collection; payment not guaranteed</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buyback" forceMount className="space-y-5 data-[state=inactive]:hidden">
          <section aria-labelledby="buyback-mode-heading" className="space-y-2">
            <h2 id="buyback-mode-heading" className="text-xl font-semibold">Compare Device Buyback Offers</h2>
            <p className="text-sm text-muted-foreground">Choose a service area, then compare vendor estimates by device, condition, quantity, and pricing unit. Only vendors who have enabled buyback availability appear. A buyback request does not create a recycling pickup.</p>
          </section>
          <div className="max-w-sm space-y-2">
            <label htmlFor="buyback-service-city" className="text-sm font-medium">Buyback service city</label>
            <select
              id="buyback-service-city"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            >
              <option value="">Choose a city</option>
              {serviceCities.map((serviceCity) => <option key={serviceCity} value={serviceCity}>{serviceCity}</option>)}
            </select>
          </div>
          {!city && <p className="text-sm text-muted-foreground">Choose a supported service city to compare local vendor offers.</p>}
          <BuybackMarketplace city={city} location={location} />
        </TabsContent>

        <TabsContent value="recycling" forceMount className="space-y-6 data-[state=inactive]:hidden">
          <section aria-labelledby="recycling-mode-heading" className="space-y-2">
            <h2 id="recycling-mode-heading" className="text-xl font-semibold">Find a Responsible Recycling Pickup</h2>
            <p className="text-sm text-muted-foreground">Search for a recycler and schedule collection. This recycling request is separate from Device Buyback and does not guarantee payment.</p>
          </section>
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="min-w-0 space-y-5" aria-label="Recycler search results">
              <Card>
                <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.65fr)_auto_auto] sm:items-end sm:p-5">
                  <div className="space-y-2">
                    <label htmlFor="recycler-category" className="text-sm font-medium">E-waste category</label>
                    <select
                      id="recycler-category"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={category}
                      onChange={(event) => { setCategory(event.target.value); setSelectedRecycler(null); }}
                    >
                      <option value="">All categories</option>
                      {recyclingCategories.map((supportedCategory) => <option key={supportedCategory} value={supportedCategory}>{supportedCategory}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="recycler-city" className="text-sm font-medium">Service city</label>
                    <select
                      id="recycler-city"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={city}
                      onChange={(event) => { setCity(event.target.value); setSelectedRecycler(null); setLocationMessage(''); }}
                    >
                      <option value="">Choose a city</option>
                      {serviceCities.map((serviceCity) => <option key={serviceCity} value={serviceCity}>{serviceCity}</option>)}
                    </select>
                  </div>
                  <Button variant="outline" onClick={fetchRecyclers}>Search</Button>
                  <Button variant="outline" onClick={handleUseLocation} disabled={isLocating}><LocateFixed className="mr-2 h-4 w-4" />{isLocating ? 'Detecting...' : 'Use my location'}</Button>
                </CardContent>
              </Card>
              {location && locationLabel && <p className="break-words text-sm text-primary">Location detected: {locationLabel}</p>}
              {locationMessage && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">{locationMessage}</p>}
              {!city && !locationMessage && <p className="text-sm text-muted-foreground">Choose a supported service city to see local recommendations, or use your location.</p>}
              {isLoading ? (
                <p className="py-4 text-sm text-muted-foreground" role="status">Finding suitable recyclers...</p>
              ) : !city ? (
                <Card><CardContent className="space-y-2 pt-6 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Choose a supported service city.</p>
                  <p>Recycler results are limited to the service areas listed above.</p>
                </CardContent></Card>
              ) : recommended.length === 0 ? (
                <Card><CardContent className="space-y-2 pt-6 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">No matching recyclers found in {city}.</p>
                  <p>{category ? `No active recycler in this service area currently lists support for “${category}”. Try another category or clear your search.` : 'There are no active recyclers available in this service area.'}</p>
                </CardContent></Card>
              ) : (
                <section className="space-y-3" aria-labelledby="recommended-recyclers">
                  <div><h3 id="recommended-recyclers" className="text-lg font-semibold">Available recyclers for {city}</h3><p className="text-sm text-muted-foreground">{category ? 'Matching service area and category.' : 'Eligible recyclers in the selected service area.'}</p></div>
                  {recommended.map((recycler) => recyclerCard(recycler, true))}
                </section>
              )}
            </section>
            <aside className="min-w-0">
              {selectedRecycler ? (
                <PickupForm
                  selectedRecycler={selectedRecycler}
                  initialCategory={category}
                  initialDeviceType={deviceType}
                  initialCondition={condition}
                  initialHazard={hazard}
                  initialAddress={locationLabel}
                  initialLocation={location}
                  onPickupRequested={() => setSelectedRecycler(null)}
                />
              ) : (
                <Card>
                  <CardHeader><CardTitle>Ready to recycle?</CardTitle><CardDescription>Select a recycler to open the pickup request form.</CardDescription></CardHeader>
                  <CardContent><Button asChild className="w-full"><Link to="/dashboard">View your pickup history</Link></Button></CardContent>
                </Card>
              )}
            </aside>
          </div>
          <section aria-labelledby="recycling-pickup-history" className="space-y-3">
            <div><h3 id="recycling-pickup-history" className="text-lg font-semibold">My Recycling Pickups</h3><p className="text-sm text-muted-foreground">Review pickup requests, assigned recyclers, and recycling progress.</p></div>
            {activeMode === 'recycling' && <PickupList filter="user" />}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
