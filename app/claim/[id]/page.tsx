'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, MapPin, Bike } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { getIdToken } from '@/lib/authToken';
import { EmptyState } from '@/components/EmptyState';
import { LoadingButton } from '@/components/LoadingButton';

interface PageProps {
  params: Promise<{ id: string }>;
}

type PedidoPreview = {
  id: string;
  restaurante: string;
  clienteDireccion: string;
  clienteNombre: string;
  total: number;
  paymentMethod?: 'efectivo' | 'transferencia';
  serviceCost?: number;
  items?: string[];
};

export default function ClaimPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [state, setState] = useState<'checking' | 'preview' | 'redirecting' | 'taken' | 'forbidden' | 'error' | 'unavailable'>('checking');
  const [pedido, setPedido] = useState<PedidoPreview | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (user.rol !== 'rider') {
      setState('forbidden');
      return;
    }

    let cancelled = false;
    const loadPreview = async () => {
      try {
        const token = await getIdToken();
        if (!token || cancelled) {
          setState('error');
          return;
        }
        const res = await fetch(`/api/pedidos/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.status === 403 || res.status === 404) {
          setState('unavailable');
          return;
        }
        if (!res.ok) {
          setState('error');
          return;
        }
        const data = await res.json();
        setPedido({
          id: data.id,
          restaurante: data.restaurante || '—',
          clienteDireccion: data.clienteDireccion || '—',
          clienteNombre: data.clienteNombre || 'Cliente',
          total: data.total ?? 0,
          paymentMethod: data.paymentMethod === 'transferencia' ? 'transferencia' : 'efectivo',
          serviceCost: typeof data.serviceCost === 'number' ? data.serviceCost : undefined,
          items: Array.isArray(data.items) ? data.items : [],
        });
        setState('preview');
      } catch {
        if (!cancelled) setState('error');
      }
    };

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [id, user, loading, router]);

  async function handleReclamar() {
    if (!pedido || claiming) return;
    const token = await getIdToken();
    if (!token) return;
    setClaiming(true);
    try {
      const res = await fetch(`/api/pedidos/${encodeURIComponent(id)}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 200) {
        setState('redirecting');
        router.replace('/panel/rider');
        return;
      }
      if (res.status === 409) {
        setState('taken');
        return;
      }
      setState('error');
    } catch {
      setState('error');
    } finally {
      setClaiming(false);
    }
  }

  if (state === 'checking' || state === 'redirecting') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
      </main>
    );
  }

  if (state === 'forbidden') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <EmptyState
          title="Solo para riders"
          description="Esta página es solo para repartidores de Andina."
          icon={<Package className="w-7 h-7" />}
          actionLabel="Ir al inicio"
          onAction={() => router.push('/')}
        />
      </main>
    );
  }

  if (state === 'unavailable') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <EmptyState
          title="Carrera no disponible"
          description="Este pedido ya no está disponible para reclamar."
          icon={<Package className="w-7 h-7" />}
          actionLabel="Ir al panel del rider"
          onAction={() => router.push('/panel/rider')}
        />
      </main>
    );
  }

  if (state === 'taken') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <EmptyState
          title="Llegaste tarde"
          description="Otro rider ya tomó esta carrera. Pronto aparecerán más pedidos."
          icon={<Package className="w-7 h-7" />}
          actionLabel="Ir al panel del rider"
          onAction={() => router.push('/panel/rider')}
        />
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <EmptyState
          title="No se pudo reclamar la carrera"
          description="Intentá de nuevo desde tu panel del rider o verifica tu conexión."
          icon={<Package className="w-7 h-7" />}
          actionLabel="Ir al panel del rider"
          onAction={() => router.push('/panel/rider')}
        />
      </main>
    );
  }

  if (state === 'preview' && pedido) {
    const totalNum = pedido.total ?? 0;
    const costoEnvioNum = typeof pedido.serviceCost === 'number' ? pedido.serviceCost : totalNum;
    return (
      <main className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 bg-dorado-oro/10 border-b border-dorado-oro/20">
              <h1 className="font-black text-lg text-gray-900">Nueva carrera</h1>
              <p className="text-sm text-gray-600">#{pedido.id}</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-gray-400">Restaurante</p>
                <p className="font-bold text-gray-900">{pedido.restaurante}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Cliente</p>
                <p className="font-bold text-gray-900">{pedido.clienteNombre}</p>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {pedido.clienteDireccion}
                </p>
              </div>
              {Array.isArray(pedido.items) && pedido.items.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Productos</p>
                  <ul className="text-sm text-gray-700 space-y-0.5">
                    {pedido.items.slice(0, 5).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                    {pedido.items.length > 5 && <li className="text-gray-500">+{pedido.items.length - 5} más</li>}
                  </ul>
                </div>
              )}
              {pedido.paymentMethod === 'transferencia' ? (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <p className="text-sm font-bold text-blue-800">
                    💳 TRANSFERENCIA LISTA - COBRAR SOLO ENVÍO: ${costoEnvioNum.toFixed(2)}
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5">Pago por transferencia — cobrar solo el envío al cliente.</p>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <p className="text-sm font-bold text-emerald-800">
                    💵 COBRAR TOTAL AL CLIENTE: ${totalNum.toFixed(2)}
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">Cobrar el total en efectivo al cliente.</p>
                </div>
              )}
              <LoadingButton
                type="button"
                loading={claiming}
                onClick={handleReclamar}
                className="w-full py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black text-base flex items-center justify-center gap-2"
              >
                <Bike className="w-5 h-5" />
                Reclamar carrera
              </LoadingButton>
            </div>
          </div>
          <p className="text-center mt-4">
            <button
              type="button"
              onClick={() => router.push('/panel/rider')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Volver al panel
            </button>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
    </main>
  );
}
