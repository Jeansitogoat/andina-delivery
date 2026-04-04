'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, ExternalLink } from 'lucide-react';

/** Nominatim: min lon, max lat, max lon, min lat — área Piñas / sur de El Oro. */
const NOMINATIM_VIEWBOX_PINAS = '-79.78,-3.62,-79.58,-3.74';

const NOMINATIM_HEADERS = {
  'Accept-Language': 'es',
  'User-Agent': 'AndinaDelivery/1.0 (contact: https://andina-delivery.web.app)',
} as const;

const MapPicker = dynamic(() => import('./usuario/MapPicker'), { ssr: false });

type Props = {
  value: string;
  onChange: (_value: string) => void;
  /** Se invoca al geocodificar o al elegir un punto en el mapa. */
  onCoordsChange?: (_lat: number, _lng: number) => void;
  /** Coordenadas iniciales (p. ej. al editar un local que ya tiene lat/lng). */
  initialLat?: number | null;
  initialLng?: number | null;
  label?: string;
  placeholder?: string;
  compact?: boolean;
};

/**
 * Campo de dirección con mapa para ubicar (igual lógica que en direcciones de usuario).
 */
export default function CampoUbicacionConMapa({
  value,
  onChange,
  onCoordsChange,
  initialLat,
  initialLng,
  label = 'Dirección',
  placeholder = 'Ej. Dirección de entrega en Piñas',
  compact = false,
}: Props) {
  const [lat, setLat] = useState<number | null>(initialLat ?? null);
  const [lng, setLng] = useState<number | null>(initialLng ?? null);
  const [buscando, setBuscando] = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(initialLat == null && initialLng == null);
  const [sugerencias, setSugerencias] = useState<Array<{ lat: number; lng: number; label: string }>>([]);

  useEffect(() => {
    if (initialLat != null && initialLng != null) {
      setLat(initialLat);
      setLng(initialLng);
    }
  }, [initialLat, initialLng]);

  function abrirEnMapa() {
    const q =
      lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(value.trim() || 'Piñas, El Oro, Ecuador');
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  function aplicarResultado(latNum: number, lngNum: number, displayName?: string) {
    setLat(latNum);
    setLng(lngNum);
    onCoordsChange?.(latNum, lngNum);
    if (displayName) onChange(String(displayName).trim());
    setMostrarMapa(true);
    setSugerencias([]);
  }

  async function buscarEnMapa() {
    const q = value.trim() || 'Piñas, El Oro, Ecuador';
    if (!q) return;
    setBuscando(true);
    setSugerencias([]);
    try {
      const params = new URLSearchParams({
        q,
        format: 'json',
        limit: '8',
        countrycodes: 'ec',
        addressdetails: '1',
        viewbox: NOMINATIM_VIEWBOX_PINAS,
        bounded: '1',
      });
      let res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: NOMINATIM_HEADERS,
      });
      let data: Array<{ lat: string; lon: string; display_name?: string }> = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        const fallback = new URLSearchParams({
          q,
          format: 'json',
          limit: '8',
          countrycodes: 'ec',
          addressdetails: '1',
        });
        res = await fetch(`https://nominatim.openstreetmap.org/search?${fallback.toString()}`, {
          headers: NOMINATIM_HEADERS,
        });
        data = await res.json();
      }
      if (!Array.isArray(data) || data.length === 0) return;

      const mapped = data.map((row) => ({
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lon),
        label: String(row.display_name ?? '').trim() || `${row.lat}, ${row.lon}`,
      })).filter((r) => !Number.isNaN(r.lat) && !Number.isNaN(r.lng));

      if (mapped.length === 1) {
        aplicarResultado(mapped[0].lat, mapped[0].lng, mapped[0].label);
      } else {
        setSugerencias(mapped);
        setMostrarMapa(true);
      }
    } catch {
      // silencioso
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="space-y-2">
      {label ? (
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </label>
      ) : null}
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 px-4 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30 ${
            compact ? 'py-2.5 text-sm' : 'py-3'
          }`}
        />
        <button
          type="button"
          onClick={buscarEnMapa}
          disabled={buscando}
          className="flex-shrink-0 px-3 rounded-xl bg-rojo-andino/10 hover:bg-rojo-andino/20 text-rojo-andino transition-colors disabled:opacity-50"
          title="Buscar en mapa"
        >
          <MapPin className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
        </button>
        <button
          type="button"
          onClick={abrirEnMapa}
          className="flex-shrink-0 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          title="Abrir en Google Maps"
        >
          <ExternalLink className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Usa el ícono de ubicación para buscar y marcar en el mapa. El de enlace abre Google Maps.
      </p>
      {sugerencias.length > 1 ? (
        <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 max-h-48 overflow-y-auto text-sm">
          {sugerencias.map((s, i) => (
            <li key={`${s.lat},${s.lng},${i}`}>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-amber-50/80 text-gray-800"
                onClick={() => aplicarResultado(s.lat, s.lng, s.label)}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {mostrarMapa && (
        <div className="pt-2">
          <MapPicker
            lat={lat}
            lng={lng}
            onSelect={(newLat, newLng, addr) => {
              setLat(newLat);
              setLng(newLng);
              onCoordsChange?.(newLat, newLng);
              if (addr) onChange(addr);
            }}
            className="rounded-xl overflow-hidden border border-gray-200"
          />
          <button
            type="button"
            onClick={() => setMostrarMapa(false)}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700"
          >
            Ocultar mapa
          </button>
        </div>
      )}
      {!mostrarMapa && (
        <button
          type="button"
          onClick={() => setMostrarMapa(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-amber-200 bg-amber-50/80 text-amber-800 font-semibold text-sm hover:bg-amber-100 hover:border-amber-300 transition-colors"
        >
          <MapPin className="w-4 h-4" />
          Mostrar mapa para ubicar el pin exacto
        </button>
      )}
    </div>
  );
}
