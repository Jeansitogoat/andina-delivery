'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Minus, Truck, Clock, Package } from 'lucide-react';
import type { Local, MenuItem } from '@/lib/data';
import LocalLogo from '@/components/LocalLogo';
import { getSafeImageSrc } from '@/lib/validImageUrl';
import { useCart } from '@/lib/useCart';
import { useAuth } from '@/lib/useAuth';
import { getIdToken } from '@/lib/authToken';

const BASE_ENVIO = 1.5;
const POR_PARADA_ADICIONAL = 0.25;

type StopData = {
  localId: string;
  local: Local | null;
  menu: MenuItem[];
  enrichedItems: Array<{ id: string; name: string; price: number; image?: string; qty: number; note?: string }>;
  subtotal: number;
};

export default function CarritoPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { cart, hydrated, addItem, removeItem, clearCart } = useCart();
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

  useEffect(() => {
    if (!hydrated || cart.stops.length === 0) return;
    let cancelled = false;
    setLoadingStops(true);
    Promise.all(
      cart.stops.map(async (stop) => {
        const res = await fetch(`/api/locales/${stop.localId}`).then((r) => (r.ok ? r.json() : null));
        const data = res as { local: Local; menu?: MenuItem[] } | null;
        const local = data?.local ?? null;
        const menu = data?.menu ?? [];
        const enrichedItems = stop.items
          .map((c) => {
            const item = menu.find((i) => i.id === c.id);
            if (!item) return null;
            return { ...item, qty: c.qty, note: c.note };
          })
          .filter(Boolean) as StopData['enrichedItems'];
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
  }, [cart.stops]);

  const numParadas = stopsData.length;
  const envioTarifa = numParadas <= 1
    ? BASE_ENVIO
    : BASE_ENVIO + (numParadas - 1) * POR_PARADA_ADICIONAL;
  const subtotal = stopsData.reduce((s, d) => s + d.subtotal, 0);
  const total = subtotal + envioTarifa;
  const totalCount = stopsData.reduce((s, d) => s + d.enrichedItems.reduce((a, i) => a + i.qty, 0), 0);
  const allLoaded = cart.stops.length > 0 && stopsData.length === cart.stops.length && stopsData.every((d) => d.local != null);

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
      </main>
    );
  }

  if (cart.stops.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <Package className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Tu carrito está vacío</h2>
        <p className="text-gray-500 text-center mb-6">Agregá productos desde un restaurante para hacer tu pedido.</p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="py-3 px-6 rounded-2xl bg-rojo-andino text-white font-bold shadow-lg hover:bg-rojo-andino/90 transition-colors"
        >
          Seguir comprando
        </button>
      </main>
    );
  }

  if (loadingStops || !allLoaded) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen bg-gray-50 flex flex-col transition-all duration-300 ${
        pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <header className="bg-white sticky top-0 z-10 shadow-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-bold text-lg text-gray-900">Mi pedido</h1>
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
                className="text-sm text-rojo-andino hover:underline font-medium"
              >
                Volver al panel
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                clearCart();
                router.push('/');
              }}
              className="text-sm text-gray-400 hover:text-rojo-andino transition-colors font-medium"
            >
              Limpiar
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-4">
        {stopsData.map((stop) => (
          <div key={stop.localId} className="space-y-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
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

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-50">
                {stop.enrichedItems.map((item) => (
                  <div key={`${stop.localId}-${item.id}`} className="px-4 py-4 flex items-center gap-3">
                    {getSafeImageSrc(item.image) && (
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                        <Image src={getSafeImageSrc(item.image)!} alt={item.name} fill className="object-cover" sizes="56px" unoptimized={item.image?.startsWith('data:')} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
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
                        onClick={() => removeItem(item.id, stop.localId)}
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
                        onClick={() => addItem(stop.localId, item.id)}
                        className="w-8 h-8 rounded-xl bg-rojo-andino hover:bg-rojo-andino/90 flex items-center justify-center transition-colors active:scale-90"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="font-bold text-sm text-gray-500 uppercase tracking-wide">Resumen</p>
          </div>
          <div className="px-4 py-4 space-y-2.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Productos ({totalCount})</span>
              <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Costo de envío</span>
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
              {numParadas > 1 ? `${numParadas} paradas · ` : ''}Envío ${envioTarifa.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent px-4 pb-6 pt-3">
        <div className="max-w-2xl mx-auto space-y-2">
          {seguimientoOrderId && (
            <button
              type="button"
              onClick={() => router.push(`/pedido/${seguimientoOrderId}`)}
              className="w-full py-3 rounded-xl border-2 border-dorado-oro/50 bg-dorado-oro/10 text-dorado-oro font-semibold text-sm hover:bg-dorado-oro/20 transition-colors flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4" />
              Ver seguimiento del pedido activo
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push('/checkout')}
            className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold text-base shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
