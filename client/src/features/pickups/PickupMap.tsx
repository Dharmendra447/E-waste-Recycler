import * as React from 'react';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Pickup } from '@/types';

interface PickupMapProps {
  pickup: Pick<Pickup, 'address' | 'latitude' | 'longitude'>;
}

const pickupMarkerIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function PickupMap({ pickup }: PickupMapProps) {
  const mapElement = React.useRef<HTMLDivElement>(null);
  const latitude = pickup.latitude;
  const longitude = pickup.longitude;
  const hasCoordinates =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  React.useEffect(() => {
    if (!hasCoordinates || !mapElement.current || latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      return;
    }

    const map = L.map(mapElement.current, { scrollWheelZoom: false }).setView([latitude, longitude], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const marker = L.marker([latitude, longitude], { icon: pickupMarkerIcon }).addTo(map);
    const address = document.createElement('span');
    address.textContent = pickup.address || 'Pickup location';
    marker.bindPopup(address).openPopup();
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
    };
  }, [hasCoordinates, latitude, longitude, pickup.address]);

  const directionsUrl = hasCoordinates
    ? `https://www.openstreetmap.org/directions?to=${encodeURIComponent(`${latitude},${longitude}`)}`
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-primary" />
          Pickup location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-5 text-muted-foreground">{pickup.address || 'No pickup address was provided.'}</p>
        {hasCoordinates ? (
          <>
            <div ref={mapElement} className="h-64 w-full overflow-hidden rounded-xl border border-border bg-muted sm:h-72" aria-label="Map showing the pickup location" />
            <a
              className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={directionsUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
            >
              Open directions in OpenStreetMap
            </a>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Map is unavailable because valid pickup coordinates were not provided. The address above is the original pickup address.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
