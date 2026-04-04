'use client';

import { useEffect, useRef, useState } from 'react';
import type { Circle, Map, Marker } from 'leaflet';

const PIÑAS_CENTER = { lat: -3.681, lng: -79.681 };

/**
 * Pin destino: la punta del marcador coincide con el borde inferior del icono (anchor Leaflet en el suelo).
 */
const PIN_DEST_HTML = `
<svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <filter id="mpin" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.28"/></filter>
  </defs>
  <path filter="url(#mpin)" fill="#b91c1c" d="M18 3C8.6 3 2 9.8 2 18.2c0 10.5 14.2 26.5 15.7 28.1.1.2.3.3.5.4h.2c.2 0 .4-.1.5-.3C20.4 44.7 34 28.7 34 18.2 34 9.8 27.4 3 18 3z"/>
  <circle cx="18" cy="17" r="5" fill="#fff"/>
</svg>`;

export interface MapPickerProps {
  lat?: number | null;
  lng?: number | null;
  onSelect: (_lat: number, _lng: number, _address?: string) => void;
  className?: string;
}

export default function MapPicker({ lat, lng, onSelect, className = '' }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const userAccCircleRef = useRef<Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    let cancelled = false;

    async function initMap() {
      try {
        const L = (await import('leaflet')).default;
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = '';
          document.head.appendChild(link);
        }

        if (cancelled || !containerRef.current) return;

        const center: [number, number] =
          lat != null && lng != null ? [lat, lng] : [PIÑAS_CENTER.lat, PIÑAS_CENTER.lng];
        const map = L.map(containerRef.current).setView(center, 18);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        mapRef.current = map;

        const pinIcon = L.divIcon({
          className: 'map-pin-dest',
          html: PIN_DEST_HTML,
          iconSize: [36, 48],
          iconAnchor: [18, 48],
        });

        const marker = L.marker(center, { icon: pinIcon, draggable: true }).addTo(map);
        markerRef.current = marker;

        const userDotIcon = L.divIcon({
          className: 'user-gps-marker',
          html:
            '<div style="width:12px;height:12px;background:rgba(37,99,235,0.92);border:2px solid rgba(255,255,255,0.95);border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.25);"></div>',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const reverseGeocodeAndSelect = async (latVal: number, lngVal: number) => {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latVal}&lon=${lngVal}&format=json`,
              {
                headers: {
                  'Accept-Language': 'es',
                  'User-Agent': 'AndinaDelivery/1.0',
                },
              }
            );
            const data = await res.json();
            const addr = (data?.display_name && String(data.display_name).trim()) || undefined;
            onSelect(latVal, lngVal, addr || `${latVal.toFixed(6)}, ${lngVal.toFixed(6)}`);
          } catch {
            onSelect(latVal, lngVal, `${latVal.toFixed(6)}, ${lngVal.toFixed(6)}`);
          }
        };

        map.on('click', async (e: { latlng: { lat: number; lng: number } }) => {
          const { lat: newLat, lng: newLng } = e.latlng;
          marker.setLatLng([newLat, newLng]);
          await reverseGeocodeAndSelect(newLat, newLng);
        });

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          reverseGeocodeAndSelect(pos.lat, pos.lng);
        });

        if (lat != null && lng != null) {
          map.setView([lat, lng], 18);
          marker.setLatLng([lat, lng]);
        }

        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              if (cancelled || !mapRef.current) return;
              const uLat = pos.coords.latitude;
              const uLng = pos.coords.longitude;
              if (userMarkerRef.current) {
                userMarkerRef.current.setLatLng([uLat, uLng]);
              } else {
                userMarkerRef.current = L.marker([uLat, uLng], {
                  icon: userDotIcon,
                  zIndexOffset: -200,
                  interactive: false,
                }).addTo(mapRef.current);
              }
              const acc = pos.coords.accuracy;
              if (typeof acc === 'number' && acc > 0 && acc < 400) {
                if (userAccCircleRef.current) {
                  userAccCircleRef.current.setLatLng([uLat, uLng]);
                  userAccCircleRef.current.setRadius(acc);
                } else {
                  userAccCircleRef.current = L.circle([uLat, uLng], {
                    radius: acc,
                    color: '#60a5fa',
                    weight: 1,
                    fillColor: '#93c5fd',
                    fillOpacity: 0.06,
                    interactive: false,
                  }).addTo(mapRef.current!);
                }
              }
            },
            () => {
              /* permiso denegado u error: solo mapa + pin destino */
            },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
          );
        }

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError('No se pudo cargar el mapa');
          setLoading(false);
        }
      }
    }

    initMap();
    return () => {
      cancelled = true;
      if (watchIdRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      userMarkerRef.current = null;
      if (userAccCircleRef.current && mapRef.current) {
        userAccCircleRef.current.remove();
        userAccCircleRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init map once
  }, []);

  return (
    <div className={`relative rounded-xl overflow-hidden bg-gray-100 ${className}`}>
      <div ref={containerRef} className="w-full h-48 min-h-[192px]" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500 text-sm">
          Cargando mapa...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-amber-50 text-amber-800 text-sm p-4 text-center">
          {error}
        </div>
      )}
      <p className="text-xs text-gray-500 mt-1.5 px-1">Haz clic en el mapa para marcar tu ubicación</p>
    </div>
  );
}
