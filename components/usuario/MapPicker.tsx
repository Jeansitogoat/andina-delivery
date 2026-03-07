'use client';

import { useEffect, useRef, useState } from 'react';

const PIÑAS_CENTER = { lat: -3.681, lng: -79.681 };

export interface MapPickerProps {
  lat?: number | null;
  lng?: number | null;
  onSelect: (_lat: number, _lng: number, _address?: string) => void;
  className?: string;
}

export default function MapPicker({ lat, lng, onSelect, className = '' }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    let cancelled = false;

    async function initMap() {
      try {
        const L = (await import('leaflet')).default;
        // Cargar estilos de Leaflet dinámicamente
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = '';
          document.head.appendChild(link);
        }

        if (cancelled || !containerRef.current) return;

        const center: [number, number] = lat != null && lng != null ? [lat, lng] : [PIÑAS_CENTER.lat, PIÑAS_CENTER.lng];
        const map = L.map(containerRef.current).setView(center, 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        const defaultIcon = L.divIcon({
          className: 'custom-marker',
          html: '<div style="width:24px;height:24px;background:#c40f0f;border:2px solid white;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker(center, { icon: defaultIcon, draggable: true }).addTo(map);
        mapRef.current = map;
        markerRef.current = marker;

        const reverseGeocodeAndSelect = async (latVal: number, lngVal: number) => {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latVal}&lon=${lngVal}&format=json`,
              { headers: { 'Accept-Language': 'es' } }
            );
            const data = await res.json();
            const addr = (data?.display_name && String(data.display_name).trim()) || undefined;
            onSelect(latVal, lngVal, addr || `${latVal.toFixed(5)}, ${lngVal.toFixed(5)}`);
          } catch {
            onSelect(latVal, lngVal, `${latVal.toFixed(5)}, ${lngVal.toFixed(5)}`);
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
          map.setView([lat, lng], 15);
          marker.setLatLng([lat, lng]);
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- init map once; lat/lng/onSelect used inside async callback
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
      <p className="text-xs text-gray-500 mt-1.5 px-1">Hacé clic en el mapa para marcar tu ubicación</p>
    </div>
  );
}
