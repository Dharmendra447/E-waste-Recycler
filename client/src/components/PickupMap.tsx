import React, { useState, useEffect } from 'react';
import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { Pickup } from '@/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useToast } from './ui/use-toast';

// IMPORTANT: Replace with your actual API key in a .env file
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';

export function PickupMap() {
    const [pickups, setPickups] = useState<(Pickup & { latitude?: number, longitude?: number })[]>([]);
    const [activePickup, setActivePickup] = useState<Pickup | null>(null);
    const { toast } = useToast();
    const center = { lat: 18.9, lng: 73.3 }; // Center between Mumbai and Pune

    const fetchPickups = async () => {
        try {
            const response = await fetch('/api/vendor/pickups/available', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setPickups(data.filter((p: Pickup) => p.latitude && p.longitude));
            }
        } catch (error) {
            console.error('Failed to fetch pickups for map', error);
        }
    };

    useEffect(() => {
        fetchPickups();
    }, []);
    
    const handleAssign = async (pickupId: number) => {
        try {
          const response = await fetch(`/api/pickups/${pickupId}/assign`, {
            method: 'PUT',
            credentials: 'include'
          });
          if (!response.ok) throw new Error('Failed to assign pickup.');
          toast({ title: "Success!", description: "Pickup assigned to you." });
          setActivePickup(null);
          fetchPickups(); // Refresh the map
        } catch (error) {
          toast({ title: "Error", description: "Could not assign pickup.", variant: 'destructive' });
        }
      }

    if (!API_KEY || API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
        return (
            <div className="text-destructive bg-destructive/10 p-4 rounded-md">
                <strong>Google Maps API key is missing.</strong> Please create a `.env` file in the root of your project and add your key like this: `VITE_GOOGLE_MAPS_API_KEY=your_key_here`
            </div>
        );
    }

    return (
        <APIProvider apiKey={API_KEY}>
            <div style={{ height: '600px', width: '100%', borderRadius: '0.5rem', overflow: 'hidden' }}>
                <Map
                    zoom={9}
                    center={center}
                    gestureHandling={'greedy'}
                    disableDefaultUI={true}
                    mapId={'e-waste-map'}
                >
                    {pickups.map(pickup => (
                        <Marker 
                            key={pickup.id} 
                            position={{ lat: pickup.latitude!, lng: pickup.longitude! }}
                            onClick={() => setActivePickup(pickup)}
                        />
                    ))}

                    {activePickup && activePickup.latitude && (
                        <InfoWindow
                            position={{ lat: activePickup.latitude, lng: activePickup.longitude! }}
                            onCloseClick={() => setActivePickup(null)}
                        >
                            <div className="p-2 space-y-2 max-w-xs">
                                <h4 className="font-bold">{activePickup.address}</h4>
                                <p className="text-sm">Items: {activePickup.items_description}</p>
                                <p className="text-sm">Status: <Badge variant="outline">{activePickup.status}</Badge></p>
                                <Button size="sm" className="w-full" onClick={() => handleAssign(activePickup.id)}>Accept Pickup</Button>
                            </div>
                        </InfoWindow>
                    )}
                </Map>
            </div>
        </APIProvider>
    );
}
