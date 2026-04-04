'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import { Navigation, Loader2, Home, Briefcase, MapPinned } from 'lucide-react';
import { useAddresses } from '@/lib/addressesContext';
import { useAuth } from '@/lib/useAuth';
import type { DireccionGuardada } from '@/components/usuario/SeccionDirecciones';
import { searchNominatimElOro, reverseNominatimElOro, type NominatimSearchHit } from '@/lib/nominatimElOro';
import { formatDireccionCorta } from '@/lib/formatDireccion';

const SESSION_KEY = 'andina_location_onboarding_done';

const MapPicker = dynamic(() => import('@/components/usuario/MapPicker'), { ssr: false });

const ICONOS_ETIQUETA = {
  casa: Home,
  trabajo: Briefcase,
  otro: MapPinned,
} as const;

function isOperarioSinModoCliente(
  rol: string | undefined,
  modoCliente: boolean
): boolean {
  if (modoCliente) return false;
  return rol === 'rider' || rol === 'central' || rol === 'local' || rol === 'maestro';
}

export default function GlobalLocationPrompt() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const {
    direccionEntregarLatLng,
    addressesReady,
    direcciones,
    requestUserLocation,
    addDireccion,
  } = useAddresses();

  const [clientReady, setClientReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  const [step, setStep] = useState<'search' | 'map'>('search');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [hits, setHits] = useState<NominatimSearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [referencia, setReferencia] = useState('');

  useEffect(() => {
    try {
      setOnboardingDone(sessionStorage.getItem(SESSION_KEY) === '1');
    } catch {
      setOnboardingDone(false);
    }
    setClientReady(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (!q) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    searchNominatimElOro(q)
      .then((r) => {
        if (!cancelled) setHits(r);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const modoCliente = searchParams.get('modo') === 'cliente';
  const enHomeOExpress = pathname === '/' || pathname === '/express';
  const bloqueadoOperario = user ? isOperarioSinModoCliente(user.rol, modoCliente) : false;

  const shouldShow =
    clientReady &&
    !onboardingDone &&
    enHomeOExpress &&
    addressesReady &&
    !authLoading &&
    !bloqueadoOperario &&
    direccionEntregarLatLng === null;

  const goToMap = useCallback((lat: number, lng: number, name: string) => {
    setPinLat(lat);
    setPinLng(lng);
    setDisplayName(name);
    setReferencia('');
    setStep('map');
  }, []);

  const handleUsarUbicacion = useCallback(() => {
    setGpsLoading(true);
    requestUserLocation({
      onSuccess: async (pos) => {
        setGpsLoading(false);
        const rev = await reverseNominatimElOro(pos.lat, pos.lng);
        goToMap(pos.lat, pos.lng, rev ?? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`);
      },
      onDenied: () => {
        setGpsLoading(false);
      },
    });
  }, [requestUserLocation, goToMap]);

  const handleConfirmar = useCallback(() => {
    const ref = referencia.trim();
    if (pinLat == null || pinLng == null || !ref) return;
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    const detalle = displayName.trim() || `${pinLat.toFixed(5)}, ${pinLng.toFixed(5)}`;
    const payload: Omit<DireccionGuardada, 'id'> = {
      etiqueta: 'otro',
      nombre: 'Entrega',
      detalle,
      referencia: ref,
      principal: true,
      lat: pinLat,
      lng: pinLng,
    };
    addDireccion(payload);
    setOnboardingDone(true);
  }, [referencia, pinLat, pinLng, displayName, addDireccion]);

  const handleElegirGuardada = useCallback(
    (d: DireccionGuardada) => {
      if (typeof d.lat === 'number' && typeof d.lng === 'number' && !Number.isNaN(d.lat) && !Number.isNaN(d.lng)) {
        goToMap(d.lat, d.lng, d.detalle || d.nombre || '');
      }
    },
    [goToMap]
  );

  if (!shouldShow) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-location-title"
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden animate-fade-in">
        <div className="flex-shrink-0 pt-3 pb-2 px-4 border-b border-gray-100">
          <div className="mx-auto h-1 w-10 rounded-full bg-gray-200 sm:hidden" aria-hidden />
          <h2 id="global-location-title" className="text-lg font-bold text-gray-900 mt-2 text-center">
            ¿Dónde te llevamos el pedido?
          </h2>
          <p className="text-xs text-gray-500 text-center mt-1">Piñas, Portovelo, Zaruma y zona</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          {step === 'search' ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleUsarUbicacion}
                disabled={gpsLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-rojo-andino text-white font-bold text-sm hover:bg-rojo-andino/90 disabled:opacity-60 shadow-md"
              >
                {gpsLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="text-lg" aria-hidden>
                    📍
                  </span>
                )}
                Usar mi ubicación actual
              </button>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Buscar dirección
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Calle, barrio, lugar…"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30 text-gray-900 placeholder:text-gray-400"
                    autoComplete="street-address"
                  />
                  {searchLoading ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                  ) : null}
                </div>
              </div>

              {hits.length > 0 ? (
                <ul className="rounded-xl border border-gray-100 divide-y divide-gray-100 max-h-44 overflow-y-auto text-sm">
                  {hits.map((h, i) => (
                    <li key={`${h.lat},${h.lng},${i}`}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-amber-50/80 text-gray-800 flex gap-2"
                        onClick={() => goToMap(h.lat, h.lng, h.displayName)}
                      >
                        <Navigation className="w-4 h-4 text-rojo-andino flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{h.displayName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {user && direcciones.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Direcciones guardadas
                  </p>
                  <ul className="space-y-2">
                    {direcciones.map((d) => {
                      const Icon = ICONOS_ETIQUETA[d.etiqueta];
                      const tieneCoords =
                        typeof d.lat === 'number' &&
                        typeof d.lng === 'number' &&
                        !Number.isNaN(d.lat) &&
                        !Number.isNaN(d.lng);
                      return (
                        <li key={d.id}>
                          <button
                            type="button"
                            disabled={!tieneCoords}
                            onClick={() => handleElegirGuardada(d)}
                            className="w-full flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/80 hover:bg-amber-50/80 disabled:opacity-40 disabled:cursor-not-allowed text-left"
                          >
                            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 border border-gray-100">
                              <Icon className="w-4 h-4 text-rojo-andino" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 text-sm truncate">{d.nombre}</p>
                              <p className="text-xs text-gray-600 line-clamp-2">
                                {formatDireccionCorta(d.detalle) || d.nombre}
                              </p>
                              {!tieneCoords ? (
                                <p className="text-[11px] text-amber-700 mt-1">Sin ubicación en mapa — busca arriba</p>
                              ) : null}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl border border-gray-200 h-[min(52vh,320px)] flex flex-col overflow-hidden bg-gray-100">
                {pinLat != null && pinLng != null ? (
                  <MapPicker
                    lat={pinLat}
                    lng={pinLng}
                    onSelect={(la, ln, addr) => {
                      setPinLat(la);
                      setPinLng(ln);
                      if (addr) setDisplayName(addr);
                    }}
                    className="flex-1 flex flex-col min-h-0 rounded-none"
                    mapContainerClassName="w-full flex-1 min-h-[200px] h-full"
                    hideFooterHint
                  />
                ) : null}
                <div className="pointer-events-none absolute top-2 left-2 right-2 z-[1000] rounded-xl bg-white/95 backdrop-blur-sm px-3 py-2 text-xs text-gray-800 shadow border border-gray-100/80 text-center">
                  ¿El pin está bien ubicado? Ajusta el mapa si es necesario
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Referencia o número de casa <span className="text-rojo-andino">*</span>
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ej: casa esquinera, frente al estadio"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30 text-gray-900"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('search')}
                  className="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={handleConfirmar}
                  disabled={!referencia.trim() || pinLat == null || pinLng == null}
                  className="flex-1 py-3 rounded-xl bg-rojo-andino text-white font-bold hover:bg-rojo-andino/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirmar dirección
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
