'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Loader2,
  Home,
  Briefcase,
  MapPinned,
  Search,
  Crosshair,
  History,
  Globe,
  MapPin,
  ArrowLeft,
  X,
} from 'lucide-react';
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

/** Fila tipo lista iOS: icono oscuro + título + opcional subtítulo */
function ListRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
  disabled,
  loading,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const content = (
    <>
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900">
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-gray-500" /> : <Icon className="h-5 w-5" strokeWidth={1.75} />}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[15px] font-medium leading-snug text-gray-900">{title}</p>
        {subtitle ? <p className="mt-0.5 text-[13px] text-gray-500">{subtitle}</p> : null}
      </div>
    </>
  );

  if (onClick && !disabled) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl py-2 pl-1 pr-2 text-left transition-colors active:bg-gray-50"
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-3 rounded-2xl py-2 pl-1 pr-2 ${disabled ? 'opacity-45' : ''}`}>
      {content}
    </div>
  );
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
  /** Remount MapPicker al recentrar con GPS */
  const [mapKey, setMapKey] = useState(0);
  const [infoDismissed, setInfoDismissed] = useState(false);

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
    setInfoDismissed(false);
    setMapKey((k) => k + 1);
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

  const handleRecentrarGps = useCallback(() => {
    requestUserLocation({
      onSuccess: async (pos) => {
        setPinLat(pos.lat);
        setPinLng(pos.lng);
        const rev = await reverseNominatimElOro(pos.lat, pos.lng);
        if (rev) setDisplayName(rev);
        setMapKey((k) => k + 1);
      },
    });
  }, [requestUserLocation]);

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

  const clearDisplayName = useCallback(() => {
    setDisplayName('');
  }, []);

  if (!shouldShow) return null;

  /* --- Paso mapa: pantalla completa estilo apps delivery --- */
  if (step === 'map' && pinLat != null && pinLng != null) {
    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-location-title"
      >
        <header className="relative z-[1100] flex items-center px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
          <button
            type="button"
            onClick={() => setStep('search')}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-gray-900 shadow-md backdrop-blur-sm transition-colors active:scale-[0.98]"
            aria-label="Volver"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={2} />
          </button>
        </header>

        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 flex flex-col">
            <MapPicker
              key={mapKey}
              lat={pinLat}
              lng={pinLng}
              onSelect={(la, ln, addr) => {
                setPinLat(la);
                setPinLng(ln);
                if (addr) setDisplayName(addr);
              }}
              className="flex h-full min-h-0 flex-1 flex-col rounded-none bg-gray-200"
              mapContainerClassName="w-full min-h-0 flex-1"
              hideFooterHint
            />
          </div>

          {!infoDismissed ? (
            <div className="pointer-events-auto absolute left-3 right-3 top-4 z-[1050] max-w-lg mx-auto">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 px-4 py-3 pr-10 text-white shadow-lg">
                <button
                  type="button"
                  onClick={() => setInfoDismissed(true)}
                  className="absolute right-2 top-2 rounded-full p-1 text-white/90 hover:bg-white/10"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="text-[15px] font-semibold leading-snug">¿El pin está bien ubicado?</p>
                <p className="mt-1 text-[13px] leading-snug text-white/90">
                  Si no coincide con tu dirección, mueve el mapa hasta tu puerta o usa el botón de ubicación.
                </p>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleRecentrarGps}
            className="pointer-events-auto absolute bottom-[calc(13rem+env(safe-area-inset-bottom))] right-4 z-[1050] flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-800 shadow-xl ring-1 ring-black/5 transition-transform active:scale-95 sm:bottom-[calc(12rem+env(safe-area-inset-bottom))]"
            aria-label="Ir a mi ubicación"
          >
            <Crosshair className="h-6 w-6" strokeWidth={2} />
          </button>
        </div>

        <div className="relative z-[1100] rounded-t-[1.35rem] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-8px_40px_rgba(0,0,0,0.12)]">
          <h2 id="confirm-location-title" className="text-center text-lg font-bold tracking-tight text-gray-900">
            Confirma tu ubicación
          </h2>

          <div className="mt-4">
            <label className="sr-only">Dirección</label>
            <div className="relative">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Dirección en el mapa"
                className="w-full rounded-2xl border border-transparent bg-gray-100 py-3.5 pl-4 pr-11 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-rojo-andino/30 focus:outline-none focus:ring-2 focus:ring-rojo-andino/15"
              />
              {displayName ? (
                <button
                  type="button"
                  onClick={clearDisplayName}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-500 hover:bg-gray-200/80"
                  aria-label="Limpiar dirección"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500">
              Referencia o número de casa <span className="text-rojo-andino">*</span>
            </label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej: frente al estadio, casa verde, segundo piso"
              className="input-mobile w-full rounded-2xl border-gray-200 bg-gray-50/90 py-3.5 text-[15px]"
            />
          </div>

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={!referencia.trim()}
            className="btn-primary-ui mt-5 w-full rounded-full py-4 text-[16px] shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
          >
            Confirmar
          </button>
        </div>
      </div>
    );
  }

  /* --- Paso búsqueda: bottom sheet limpio estilo referencia --- */
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 backdrop-blur-[2px] sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-location-title"
    >
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-[1.75rem] animate-fade-in">
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-gray-200 sm:hidden" aria-hidden />

        <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2">
          <h2 id="global-location-title" className="text-[22px] font-bold leading-tight tracking-tight text-gray-900">
            Ingresa tu dirección
          </h2>
          <p className="mt-1.5 text-[14px] text-gray-500">Para mostrarte locales y envíos según tu zona en El Oro.</p>

          <div className="relative mt-6">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Dirección o punto de referencia"
              className="w-full rounded-full border-0 bg-[#F2F2F2] py-3.5 pl-5 pr-12 text-[15px] text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-rojo-andino/25"
              autoComplete="street-address"
            />
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
              {searchLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" strokeWidth={2} />
              )}
            </div>
          </div>

          <div className="mt-6 space-y-1">
            <ListRow
              icon={Crosshair}
              title="Mi ubicación actual"
              subtitle="Usa el GPS del teléfono"
              onClick={handleUsarUbicacion}
              loading={gpsLoading}
            />

            {hits.length > 0 ? (
              <div className="pt-2">
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Resultados</p>
                <ul className="space-y-0.5">
                  {hits.map((h, i) => (
                    <li key={`${h.lat},${h.lng},${i}`}>
                      <button
                        type="button"
                        onClick={() => goToMap(h.lat, h.lng, h.displayName)}
                        className="flex w-full items-start gap-3 rounded-2xl py-2.5 pl-1 pr-2 text-left transition-colors active:bg-gray-50"
                      >
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900">
                          <MapPin className="h-5 w-5" strokeWidth={1.75} />
                        </div>
                        <span className="min-w-0 flex-1 pt-2 text-[14px] leading-snug text-gray-800 line-clamp-3">
                          {h.displayName}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {user && direcciones.length > 0 ? (
              <div className="pt-4">
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Tus direcciones
                </p>
                <ul className="space-y-0.5">
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
                          className="flex w-full items-start gap-3 rounded-2xl py-2.5 pl-1 pr-2 text-left transition-colors active:bg-gray-50 disabled:opacity-40"
                        >
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900">
                            {tieneCoords ? <History className="h-5 w-5" strokeWidth={1.75} /> : <Icon className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5">
                            <p className="text-[15px] font-medium text-gray-900">{d.nombre}</p>
                            <p className="mt-0.5 text-[13px] text-gray-500 line-clamp-2">
                              {formatDireccionCorta(d.detalle) || d.nombre}
                            </p>
                            {!tieneCoords ? (
                              <p className="mt-1 text-[12px] text-amber-700">Busca la dirección arriba para ubicarla en el mapa</p>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="mt-6 border-t border-gray-100 pt-5">
              <ListRow icon={Globe} title="Zona de entrega" subtitle="El Oro, Ecuador" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
