'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MapPicker from '@/components/usuario/MapPicker';
import { useAddresses } from '@/lib/addressesContext';
import { formatDireccionCorta } from '@/lib/formatDireccion';
import type { DireccionGuardada } from '@/components/usuario/SeccionDirecciones';
import { isOutsideCoverage } from '@/lib/location-utils';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSavedAddresses } from '@/hooks/useSavedAddresses';
import { haversineKm } from '@/lib/geo';

type LatLng = { lat: number; lng: number };

export default function AddressPicker({
  onClose,
  locals,
  coverageRadiusKm = 10,
  proximityKm = 1,
}: {
  onClose: () => void;
  locals?: LatLng[];
  coverageRadiusKm?: number;
  proximityKm?: number;
}) {
  const { direcciones, selectedId, setSelectedId } = useAddresses();
  const { favorites, upsertFavorite } = useSavedAddresses();
  const { status: geoStatus, location: gps, requestLocation } = useGeolocation();

  const current = useMemo(() => {
    if (selectedId) return direcciones.find((d) => d.id === selectedId) ?? null;
    return direcciones.find((d) => d.principal) ?? direcciones[0] ?? null;
  }, [direcciones, selectedId]);

  const PIÑAS_CENTER = useMemo<LatLng>(() => ({ lat: -3.681, lng: -79.681 }), []);

  const [step, setStep] = useState<1 | 2>(1);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [pinAddress, setPinAddress] = useState<string>('');

  const [guardadoComo, setGuardadoComo] = useState<DireccionGuardada['etiqueta']>('otro');
  const [nombre, setNombre] = useState<string>('');
  const [detalle, setDetalle] = useState<string>('');
  const [referencia, setReferencia] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [showProximityConfirm, setShowProximityConfirm] = useState(false);

  const [mapKey, setMapKey] = useState(0);
  const programmaticUpdateRef = useRef(false);
  const lastHapticAtRef = useRef<number>(0);

  const favoriteByEtiqueta = useMemo(() => favorites, [favorites]);

  useEffect(() => {
    // Abrir: siempre priorizamos GPS para centrar el mapa (prompt).
    let cancelled = false;
    (async () => {
      const nextGps = await requestLocation();
      if (cancelled) return;
      if (nextGps) {
        programmaticUpdateRef.current = true;
        setPin(nextGps);
        setPinAddress('');
        setGuardadoComo(current?.etiqueta ?? 'otro');
        return;
      }
      // Fallback: mantener centro en Piñas.
      programmaticUpdateRef.current = true;
      setPin(PIÑAS_CENTER);
      setPinAddress('');
      setGuardadoComo(current?.etiqueta ?? 'otro');
      setError('Mueve el mapa para fijar tu entrega.');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pin) return;
    if (programmaticUpdateRef.current) {
      programmaticUpdateRef.current = false;
      setMapKey((k) => k + 1);
    }
  }, [pin]);

  useEffect(() => {
    // Preparar nombres/valores para step 2 cuando entramos ahí.
    if (step !== 2) return;
    const etiquetaToNombre: Record<DireccionGuardada['etiqueta'], string> = {
      casa: 'Casa',
      trabajo: 'Trabajo',
      otro: 'Otro',
    };
    const fallbackNombre = etiquetaToNombre[guardadoComo];
    setNombre((prev) => prev || current?.nombre || fallbackNombre);
    setDetalle((prev) => prev || pinAddress || current?.detalle || '');
    setReferencia((prev) => prev || current?.referencia || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function vibrate(ms: number) {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }

  function playSoftBeep() {
    try {
      const AudioCtx = (window as unknown as { AudioContext?: typeof window.AudioContext }).AudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      osc.start(now);
      osc.stop(now + 0.06);
      setTimeout(() => ctx.close().catch(() => {}), 120);
    } catch {
      /* ignore */
    }
  }

  function maybeHapticPinMove() {
    const now = Date.now();
    if (now - lastHapticAtRef.current < 250) return;
    lastHapticAtRef.current = now;
    vibrate(10);
  }

  const coverageError = useMemo(() => {
    if (!pin || !Array.isArray(locals) || locals.length === 0) return null;
    const outside = isOutsideCoverage({ pin, locals, radiusKm: coverageRadiusKm });
    return outside ? 'Fuera de zona de entrega.' : null;
  }, [coverageRadiusKm, locals, pin]);

  function getProximityKm(): number | null {
    if (!pin || !gps) return null;
    return haversineKm(gps.lat, gps.lng, pin.lat, pin.lng);
  }

  function etiquetaATexto(etq: DireccionGuardada['etiqueta']) {
    return etq === 'casa' ? 'Casa' : etq === 'trabajo' ? 'Trabajo' : 'Otro';
  }

  function getFavoriteLabel(etq: DireccionGuardada['etiqueta']): string {
    const d =
      etq === 'casa' ? favoriteByEtiqueta.casa : etq === 'trabajo' ? favoriteByEtiqueta.trabajo : favoriteByEtiqueta.otro;
    if (!d) return 'Configurar';
    return formatDireccionCorta(d.detalle) || 'Configurar';
  }

  const canProceedToDetails = Boolean(pin) && !coverageError;

  function handleConfirmMap() {
    setError(null);
    setShowProximityConfirm(false);
    if (!pin) return;
    if (coverageError) {
      setError(coverageError);
      vibrate(30);
      return;
    }

    if (gps) {
      const km = getProximityKm();
      if (km != null && km > proximityKm) {
        setShowProximityConfirm(true);
        return;
      }
    }

    setStep(2);
  }

  function handleConfirmProximity() {
    setShowProximityConfirm(false);
    playSoftBeep();
    setStep(2);
  }

  function handleSaveDetails() {
    if (!pin) return;
    const nombreTrim = nombre.trim();
    const detalleTrim = detalle.trim();
    if (!nombreTrim || !detalleTrim) {
      setError('Faltan datos: nombre y dirección.');
      vibrate(25);
      return;
    }

    // Persistencia: “memoria” en users/{uid}.addresses via addressesContext.
    // actualizamos el favorito del tipo elegido, manteniendo principal=true.
    const savedId = upsertFavorite({
      etiqueta: guardadoComo,
      nombre: nombreTrim,
      detalle: detalleTrim,
      referencia: referencia?.trim() || undefined,
      lat: pin.lat,
      lng: pin.lng,
    });

    // Limpieza de UI + cierre
    vibrate(20);
    playSoftBeep();
    setSelectedId(savedId);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-10 h-10 rounded-2xl bg-rojo-andino/10 flex items-center justify-center text-rojo-andino">
              M
            </span>
            <div>
              <p className="font-bold text-gray-900">Elegir ubicación</p>
              <p className="text-xs text-gray-500">Casa / Trabajo / Otro</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-50">
            X
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(['casa', 'trabajo', 'otro'] as const).map((etq) => {
              const active = guardadoComo === etq;
              return (
                <button
                  key={etq}
                  type="button"
                  onClick={() => {
                    setGuardadoComo(etq);
                    const fav = etq === 'casa' ? favorites.casa : etq === 'trabajo' ? favorites.trabajo : favorites.otro;
                    if (fav?.lat != null && fav?.lng != null && typeof fav.lat === 'number' && typeof fav.lng === 'number') {
                      programmaticUpdateRef.current = true;
                      setPin({ lat: fav.lat, lng: fav.lng });
                      setPinAddress(fav.detalle);
                    }
                  }}
                  className={`rounded-2xl border px-2 py-2 text-left transition-colors ${
                    active ? 'border-rojo-andino bg-rojo-andino/5' : 'border-gray-100 bg-white hover:bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-bold text-gray-900">{etiquetaATexto(etq)}</p>
                  <p className={`text-xs mt-1 ${active ? 'text-rojo-andino font-semibold' : 'text-gray-500'}`}>
                    {getFavoriteLabel(etq)}
                  </p>
                </button>
              );
            })}
          </div>

          <div>
            {step === 1 ? (
              <>
                {pin ? (
                  <MapPicker
                    key={mapKey}
                    lat={pin.lat}
                    lng={pin.lng}
                    onSelect={(newLat, newLng, addr) => {
                      maybeHapticPinMove();
                      setPin({ lat: newLat, lng: newLng });
                      setPinAddress(addr ?? `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`);
                      setError(null);
                    }}
                    className="rounded-xl overflow-hidden"
                  />
                ) : (
                  <div className="h-48 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500">
                    Cargando mapa...
                  </div>
                )}
                {geoStatus !== 'granted' && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                    No pudimos obtener GPS. Mueve el mapa para fijar tu entrega.
                  </p>
                )}
                {error && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                    {error}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!canProceedToDetails}
                    onClick={handleConfirmMap}
                    className="flex-1 py-3 rounded-xl bg-rojo-andino text-white font-black disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    Confirmar esta ubicación
                  </button>
                </div>
              </>
            ) : (
              <>
                {error && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-0">
                    {error}
                  </p>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Nombre del lugar
                    </label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-rojo-andino"
                      placeholder="Ej. Mi casa"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Calle principal y número
                    </label>
                    <input
                      type="text"
                      value={detalle}
                      onChange={(e) => setDetalle(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-rojo-andino"
                      placeholder="Ej. Calle Bolívar #123, Piñas"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Referencias (para el rider)
                    </label>
                    <textarea
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-rojo-andino resize-none"
                      placeholder="Ej. Casa azul, portón blanco"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Guardar como
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['casa', 'trabajo', 'otro'] as const).map((etq) => (
                        <button
                          key={etq}
                          type="button"
                          onClick={() => setGuardadoComo(etq)}
                          className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
                            guardadoComo === etq ? 'border-rojo-andino bg-rojo-andino/5' : 'border-gray-100 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <p className="text-sm font-bold text-gray-900">{etiquetaATexto(etq)}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold"
                    >
                      Volver al mapa
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDetails}
                      className="flex-1 py-3 rounded-xl bg-rojo-andino text-white font-black"
                    >
                      Guardar y usar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {showProximityConfirm && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 animate-fade-in">
              <h3 className="font-bold text-lg text-gray-900 mb-2">¿Estás pidiendo para otro lugar?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Confirmamos entrega en: <span className="font-semibold">{pinAddress || `${pin?.lat}, ${pin?.lng}`}</span>.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowProximityConfirm(false)}
                  className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold"
                >
                  Corregir
                </button>
                <button
                  type="button"
                  onClick={handleConfirmProximity}
                  className="flex-1 py-3 rounded-xl bg-rojo-andino text-white font-black"
                >
                  Sí, confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

