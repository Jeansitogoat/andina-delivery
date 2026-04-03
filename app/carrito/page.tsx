'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Minus, Truck, Clock, Package, Loader2 } from 'lucide-react';
import type { Local, MenuItem } from '@/lib/data';
import LocalLogo from '@/components/LocalLogo';
import { getSafeImageSrc, shouldBypassImageOptimizer } from '@/lib/validImageUrl';
import { useCart } from '@/lib/useCart';
import type { CartItem } from '@/lib/cartContext';
import { useAuth } from '@/lib/useAuth';
import { useAddresses } from '@/lib/addressesContext';
import { useTarifasEnvio } from '@/lib/useTarifasEnvio';
import { haversineKm } from '@/lib/geo';
import { getIdToken } from '@/lib/authToken';
import { resolveIvaConfig } from '@/lib/order-money';

type EnrichedCartItem = {
  id: string;
  name: string;
  price: number;
  image?: string;
  qty: number;
  note?: string;
  variationName?: string;
  variationPrice?: number;
  complementSelections?: Record<string, string>;
};

type StopData = {
  localId: string;
  local: Local | null;
  menu: MenuItem[];
  enrichedItems: EnrichedCartItem[];
  subtotal: number;
};

export default function CarritoPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { cart, hydrated, addItem, removeItem, clearCart, saving } = useCart();

  // Clave estable: solo cambia cuando cambian los localIds del carrito, no en cada qty/nota
  const localIdsKey = useMemo(
    () => cart.stops.map((s) => s.localId).sort().join(','),
    [cart.stops]
  );
  // Caché en memoria de datos de locales para no refetchear en cada re-render
  const menuCacheRef = useRef<Map<string, { local: unknown; menu: unknown[] }>>(new Map());
  const { direccionEntregarLatLng, userLocationLatLng } = useAddresses();
  const { getTarifaEnvioPorDistancia, porParadaAdicional, tarifaMinima } = useTarifasEnvio();
  const [pageVisible, setPageVisible] = useState(false);
  const [stopsData, setStopsData] = useState<StopData[]>([]);
  const [loadingStops, setLoadingStops] = useState(true);
  const [seguimientoOrderId, setSeguimientoOrderId] = useState<string | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  // Botón "Ver seguimiento del pedido" cuando hay pedido activo no entregado (cliente)
  useEffect(() => {
    if (typeof window === 'undefined' || user?.rol !== 'cliente') {
      setSeguimientoOrderId(null);
      return;
    }
    let cancelled = false;
    getIdToken()
      .then((token) => {
        if (!token || cancelled) return;
        return fetch('/api/pedidos/mi-activo', {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((res) => (res && res.ok ? res.json() : null))
      .then((data: { id?: string | null } | null) => {
        if (cancelled || !data) return;
        setSeguimientoOrderId(data.id && data.id.trim() ? data.id : null);
      })
      .catch(() => {
        if (!cancelled) setSeguimientoOrderId(null);
      });
    return () => { cancelled = true; };
  }, [user?.rol]);

  useEffect(() => {
    if (hydrated && cart.stops.length === 0) {
      setStopsData([]);
      setLoadingStops(false);
    }
  }, [hydrated, cart.stops.length]);

  // Efecto de fetch: se dispara solo cuando cambian los localIds (no en cambios de qty/nota)
  useEffect(() => {
    if (!hydrated || cart.stops.length === 0) return;
    let cancelled = false;
    setLoadingStops(true);
    Promise.all(
      cart.stops.map(async (stop) => {
        // Usar caché en memoria para localIds ya cargados; evita refetch masivo
        const cached = menuCacheRef.current.get(stop.localId);
        let local: Local | null = null;
        let menu: MenuItem[] = [];
        if (cached) {
          local = cached.local as Local | null;
          menu = cached.menu as MenuItem[];
        } else {
          const res = await fetch(`/api/locales/${stop.localId}`).then((r) => (r.ok ? r.json() : null));
          const data = res as { local: Local; menu?: MenuItem[] } | null;
          local = data?.local ?? null;
          menu = data?.menu ?? [];
          menuCacheRef.current.set(stop.localId, { local, menu });
        }
        const enrichedItems = (stop.items as CartItem[])
          .map((c) => {
            const item = menu.find((i) => i.id === c.id);
            if (!item) return null;
            const unitPrice = typeof c.variationPrice === 'number' && !Number.isNaN(c.variationPrice) ? c.variationPrice : item.price;
            return {
              ...item,
              qty: c.qty,
              note: c.note,
              price: unitPrice,
              variationName: c.variationName,
              variationPrice: c.variationPrice,
              complementSelections: c.complementSelections,
            } as EnrichedCartItem;
          })
          .filter(Boolean) as EnrichedCartItem[];
        const subtotal = enrichedItems.reduce((s, i) => s + i.price * i.qty, 0);
        return { localId: stop.localId, local, menu, enrichedItems, subtotal };
      })
    )
      .then((data) => {
        if (!cancelled) setStopsData(data);
      })
      .catch(() => {
        if (!cancelled) setStopsData([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStops(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, localIdsKey]); // Solo re-fetch al cambiar qué locales hay, no en cada cambio de ítem

  // Actualizar items enriquecidos sin refetch cuando cambian qty/nota
  useEffect(() => {
    if (!hydrated || cart.stops.length === 0 || stopsData.length === 0) return;
    setStopsData((prev) =>
      prev.map((stopData) => {
        const cartStop = cart.stops.find((s) => s.localId === stopData.localId);
        if (!cartStop) return stopData;
        const enrichedItems = (cartStop.items as CartItem[])
          .map((c) => {
            const item = stopData.menu.find((i) => i.id === c.id);
            if (!item) return null;
            const unitPrice = typeof c.variationPrice === 'number' && !Number.isNaN(c.variationPrice) ? c.variationPrice : item.price;
            return { ...item, qty: c.qty, note: c.note, price: unitPrice, variationName: c.variationName, variationPrice: c.variationPrice, complementSelections: c.complementSelections } as EnrichedCartItem;
          })
          .filter(Boolean) as EnrichedCartItem[];
        return { ...stopData, enrichedItems, subtotal: enrichedItems.reduce((s, i) => s + i.price * i.qty, 0) };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.stops, hydrated]);

  const numParadas = stopsData.length;
  const firstStop = stopsData[0];
  const originLatLng = direccionEntregarLatLng ?? userLocationLatLng;
  const destLatLng = firstStop?.local && typeof firstStop.local.lat === 'number' && typeof firstStop.local.lng === 'number'
    ? { lat: firstStop.local.lat, lng: firstStop.local.lng }
    : null;
  const km = originLatLng && destLatLng ? haversineKm(originLatLng.lat, originLatLng.lng, destLatLng.lat, destLatLng.lng) : null;
  const baseEnvio = km != null ? getTarifaEnvioPorDistancia(km) : tarifaMinima;
  const envioTarifa = numParadas <= 1 ? baseEnvio : baseEnvio + (numParadas - 1) * porParadaAdicional;
  const subtotal = stopsData.reduce((s, d) => s + d.subtotal, 0);
  const totalIva = stopsData.reduce((sum, stop) => {
    const iva = resolveIvaConfig(stop.local);
    return sum + (iva.ivaEnabled ? Math.round(stop.subtotal * iva.ivaRate * 100) / 100 : 0);
  }, 0);
  const total = subtotal + totalIva + envioTarifa;
  const totalCount = stopsData.reduce((s, d) => s + d.enrichedItems.reduce((a, i) => a + i.qty, 0), 0);
  const allLoaded = cart.stops.length > 0 && stopsData.length === cart.stops.length && stopsData.every((d) => d.local != null);

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
      </main>
    );
  }

  if (cart.stops.length === 0) {
    return (
      <main className="min-h-screen bg-surface flex flex-col items-center justify-center safe-x">
        <Package className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Tu carrito está vacío</h2>
        <p className="text-gray-500 text-center mb-6">Agrega productos desde un restaurante para hacer tu pedido.</p>
        <button
          type="button"
          onClick={() => router.push('/?modo=cliente')}
          className="py-3 px-6 rounded-2xl bg-rojo-andino text-white font-bold shadow-lg hover:bg-rojo-andino/90 transition-colors"
        >
          Seguir comprando
        </button>
      </main>
    );
  }

  if (loadingStops || !allLoaded) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen bg-surface flex flex-col transition-all duration-300 ${
        pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <header className="bg-white/95 sticky top-0 z-10 shadow-soft border-b border-gray-100 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
        <div className="max-w-2xl mx-auto safe-x py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-9 w-9 md:h-10 md:w-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="font-black text-lg text-gray-900 tracking-tight">Mi pedido</h1>
            {saving && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Guardando...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user && user.rol !== 'cliente' && (
              <button
                type="button"
                onClick={() => {
                  if (user.rol === 'central') router.push('/panel/central');
                  else if (user.rol === 'rider') router.push('/panel/rider');
                  else if (user.rol === 'local') router.push((user as { localId?: string }).localId ? `/panel/restaurante/${(user as { localId?: string }).localId}` : '/panel/restaurante');
                  else if (user.rol === 'maestro') router.push('/panel/maestro');
                }}
                className="hidden md:inline text-sm text-rojo-andino hover:underline font-medium"
              >
                Volver al panel
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                clearCart();
                router.push('/?modo=cliente');
              }}
              className="text-sm text-gray-400 hover:text-rojo-andino transition-colors font-medium"
            >
              Limpiar
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full safe-x py-4 space-y-4">
        {stopsData.map((stop) => (
          <div key={stop.localId} className="space-y-3">
            <div className="card-elevated p-4 flex items-center gap-3 shadow-softlg">
              {stop.local?.logo && (
                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  <LocalLogo src={stop.local.logo} alt={stop.local.name} fill className="object-contain" sizes="56px" iconClassName="w-6 h-6 text-rojo-andino/60" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-base truncate">{stop.local?.name ?? stop.localId}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {stop.local?.time ?? '—'}
                  </span>
                  <span className="text-rojo-andino font-semibold">
                    Subtotal ${stop.subtotal.toFixed(2)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/restaurante/${stop.localId}`)}
                className="text-xs text-rojo-andino font-semibold hover:underline flex-shrink-0"
              >
                Editar
              </button>
            </div>

            <div className="card-elevated overflow-hidden shadow-softlg">
              <div className="divide-y divide-gray-50">
                {stop.enrichedItems.map((item) => {
                  const compText = item.complementSelections && Object.keys(item.complementSelections).length > 0
                    ? Object.values(item.complementSelections).join(', ')
                    : '';
                  const displayLabel = [item.name, item.variationName ? `(${item.variationName})` : '', compText ? ` · ${compText}` : ''].filter(Boolean).join(' ');
                  const options = (item.variationName || item.complementSelections) ? {
                    variationName: item.variationName,
                    variationPrice: item.variationPrice,
                    complementSelections: item.complementSelections,
                  } : undefined;
                  const lineKey = `${stop.localId}-${item.id}-${item.variationName ?? ''}-${JSON.stringify(item.complementSelections ?? {})}`;
                  return (
                  <div key={lineKey} className="px-4 py-4 flex items-center gap-3">
                    {getSafeImageSrc(item.image) && (
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                        <Image src={getSafeImageSrc(item.image)!} alt={item.name} fill className="object-cover" sizes="56px" unoptimized={shouldBypassImageOptimizer(item.image)} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{displayLabel}</p>
                      {item.note && (
                        <p className="text-xs text-gray-400 mt-0.5 italic truncate">{item.note}</p>
                      )}
                      <p className="font-bold text-gray-900 text-sm mt-1">
                        ${(item.price * item.qty).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id, stop.localId, options)}
                        className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors active:scale-90"
                      >
                        {item.qty === 1 ? (
                          <Trash2 className="w-3.5 h-3.5 text-rojo-andino" />
                        ) : (
                          <Minus className="w-3.5 h-3.5 text-gray-600" />
                        )}
                      </button>
                      <span className="font-black text-gray-900 text-base w-5 text-center">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => addItem(stop.localId, item.id, item.note, options)}
                        className="w-8 h-8 rounded-xl bg-rojo-andino hover:bg-rojo-andino/90 flex items-center justify-center transition-colors active:scale-90"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        <div className="card-elevated overflow-hidden shadow-softlg">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="font-bold text-sm text-gray-500 uppercase tracking-wide">Resumen</p>
          </div>
          <div className="px-4 py-4 space-y-2.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Productos ({totalCount})</span>
              <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
            </div>
            {totalIva > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>IVA</span>
                <span className="font-semibold text-gray-900">${totalIva.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-600">
              <span>{km == null ? 'Costo de envío (desde)' : 'Costo de envío'}</span>
              <span className="font-semibold text-rojo-andino">${envioTarifa.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-gray-100 flex justify-between font-black text-gray-900 text-base">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-dorado-oro/10 border border-dorado-oro/30 rounded-2xl p-4 flex items-start gap-3">
          <Truck className="w-5 h-5 text-dorado-oro flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-700">
            <p className="font-semibold">Entrega por Cía. Virgen de la Merced</p>
            <p className="text-gray-500 text-xs mt-0.5">
              {numParadas > 1 ? `${numParadas} paradas · ` : ''}{km == null ? 'Desde ' : ''}Envío ${envioTarifa.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-surface via-surface/95 to-transparent safe-x pb-6 pt-3 border-t border-gray-100/80">
        <div className="max-w-2xl mx-auto space-y-2">
          {seguimientoOrderId && (
            <button
              type="button"
              onClick={() => router.push(`/pedido/${seguimientoOrderId}`)}
              className="w-full min-h-[44px] py-3 rounded-2xl border-2 border-dorado-oro/50 bg-dorado-oro/10 text-dorado-oro font-semibold text-sm hover:bg-dorado-oro/20 transition-colors flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4" />
              Ver seguimiento del pedido activo
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push('/checkout')}
            className="w-full min-h-[48px] py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-black text-base shadow-softlg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Continuar
            <span className="bg-white/20 rounded-xl px-2 py-0.5 text-sm font-black">
              ${total.toFixed(2)}
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}
