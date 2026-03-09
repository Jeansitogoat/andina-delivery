'use client';

import { use, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShoppingBag,
  CheckCircle,
  Truck,
  Star,
  TrendingUp,
  ChevronRight,
  Bell,
  CreditCard,
  FileText,
  Expand,
  X,
  LogOut,
  Trash2,
} from 'lucide-react';
import NavPanel from '@/components/panel/NavPanel';
import BotonPedirRider from '@/components/panel/BotonPedirRider';
import { formatDireccionCorta } from '@/lib/formatDireccion';
import { getSafeImageSrc, getSafeDataUrl } from '@/lib/validImageUrl';
import { useNotifications } from '@/lib/useNotifications';
type PendingTransferOrder = {
  orderId: string;
  orderNum: string;
  total: number;
  direccion: string;
  items: string[];
  createdAt: number;
  comprobanteBase64?: string | null;
  comprobanteFileName?: string | null;
  comprobanteMimeType?: string | null;
};
import { useAuth } from '@/lib/useAuth';
import { getIdToken } from '@/lib/authToken';
import type { Local } from '@/lib/data';
import type { EstadoPedido } from '@/lib/types';
import ModalCerrarSesion from '@/components/panel/ModalCerrarSesion';
import SkeletonListaPedidos from '@/components/SkeletonListaPedidos';
import { isNightMode } from '@/lib/time';

type OrderStatus = 'nuevo' | 'preparando' | 'listo' | 'entregado' | 'cancelado';

interface Order {
  id: string;
  cliente: string;
  items: string[];
  total: number;
  tiempo: string;
  status: OrderStatus;
  direccion: string;
  /** Estado en Firestore para saber si ya se solicitó rider */
  estadoFirestore: EstadoPedido;
  batchId?: string | null;
  batchLeaderLocalId?: string | null;
  deliveryType?: 'delivery' | 'pickup';
}

function estadoToStatus(estado: EstadoPedido): OrderStatus {
  if (estado === 'confirmado') return 'nuevo';
  if (estado === 'preparando') return 'preparando';
  if (estado === 'listo' || estado === 'esperando_rider' || estado === 'asignado' || estado === 'en_camino') return 'listo';
  if (estado === 'cancelado_local' || estado === 'cancelado_cliente') return 'cancelado';
  return 'entregado';
}

function tiempoTranscurrido(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  return `hace ${Math.floor(mins / 60)}h`;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; next?: OrderStatus; nextEstado?: EstadoPedido; nextLabel?: string }> = {
  nuevo: { label: 'Nuevo', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', next: 'preparando', nextEstado: 'preparando', nextLabel: 'Aceptar pedido' },
  preparando: { label: 'En preparación', color: 'text-dorado-oro', bg: 'bg-yellow-50 border-yellow-200', next: 'listo', nextEstado: 'listo', nextLabel: 'Marcar listo' },
  listo: { label: 'Listo para entregar', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  entregado: { label: 'Entregado', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' },
  cancelado: { label: 'Cancelado', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

export default function PanelRestauranteIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { permission, requestPermission, loading: notifLoading } = useNotifications('restaurant', { localId: id ?? user?.localId ?? '' });
  const [local, setLocal] = useState<Local | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [newOrderToast, _setNewOrderToast] = useState<string | null>(null);
  const [pageVisible, setPageVisible] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransferOrder[]>([]);
  const [comprobanteExpandido, setComprobanteExpandido] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  /** Por batchId: true si todos los pedidos del batch están en estado listo (para habilitar Pedir Rider) */
  const [batchTodosListos, setBatchTodosListos] = useState<Record<string, boolean>>({});
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [ocupadoSaving, setOcupadoSaving] = useState(false);
  const [ocupadoToast, setOcupadoToast] = useState<string | null>(null);
  /** Entregados cargados bajo demanda (paginado, 4 por página) */
  const [deliveredList, setDeliveredList] = useState<Order[]>([]);
  const [deliveredNextCursor, setDeliveredNextCursor] = useState<string | null>(null);
  const [deliveredLoading, setDeliveredLoading] = useState(false);

  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const newOrderSoundRef = useRef<HTMLAudioElement | null>(null);
  function playNewOrderSound() {
    try {
      if (!newOrderSoundRef.current) newOrderSoundRef.current = new Audio('/sounds/new-order.mp3');
      newOrderSoundRef.current.volume = 1.0;
      newOrderSoundRef.current.play().catch(() => {});
    } catch {
      // ignorar
    }
  }

  const cargarPedidos = useCallback(async () => {
    const token = await getIdToken();
    if (!token) {
      setOrdersLoading(false);
      return;
    }
    if (user?.rol === 'maestro' && !id) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }
    const base = user?.rol === 'maestro' ? `/api/pedidos?localId=${encodeURIComponent(id)}` : '/api/pedidos';
    const sep = base.includes('?') ? '&' : '?';
    const url = `${base}${sep}soloActivos=true`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        setOrders([]);
        return;
      }
      const data = await res.json() as { pedidos: Array<{ id: string; clienteNombre: string; items: string[]; total: number; timestamp: number; estado: EstadoPedido; clienteDireccion: string; batchId?: string | null; batchLeaderLocalId?: string | null; deliveryType?: 'delivery' | 'pickup' }>; nextCursor?: string | null };
      const list: Order[] = (data.pedidos || []).map((p) => ({
        id: p.id,
        cliente: p.clienteNombre || 'Cliente',
        items: p.items || [],
        total: p.total || 0,
        tiempo: tiempoTranscurrido(p.timestamp || 0),
        status: estadoToStatus(p.estado || 'confirmado'),
        direccion: p.clienteDireccion || '—',
        estadoFirestore: p.estado || 'confirmado',
        batchId: p.batchId ?? null,
        batchLeaderLocalId: p.batchLeaderLocalId ?? null,
        deliveryType: p.deliveryType === 'pickup' ? 'pickup' : 'delivery',
      }));
      const newIds = new Set(list.map((o) => o.id));
      if (list.some((o) => !prevOrderIdsRef.current.has(o.id))) {
        playNewOrderSound();
      }
      prevOrderIdsRef.current = newIds;
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [id, user?.rol]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/locales/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: { local: Local } | null) => {
        if (!cancelled && data) {
          setLocal(data.local);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!user || (user.rol !== 'local' && user.rol !== 'maestro')) return;
    cargarPedidos();
    let t: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (t) return;
      t = setInterval(cargarPedidos, 18000); // 18s - optimizado
    };
    const stopPolling = () => {
      if (t) {
        clearInterval(t);
        t = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        cargarPedidos();
        startPolling();
      } else {
        stopPolling();
      }
    };
    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, id, cargarPedidos]);

  const loadEntregados = useCallback(async (cursor?: string | null) => {
    const token = await getIdToken();
    if (!token) return;
    const base = user?.rol === 'maestro' ? `/api/pedidos?localId=${encodeURIComponent(id)}` : '/api/pedidos';
    const sep = base.includes('?') ? '&' : '?';
    let url = `${base}${sep}estado=entregado&limit=4`;
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
    setDeliveredLoading(true);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json() as { pedidos: Array<{ id: string; clienteNombre: string; items: string[]; total: number; timestamp: number; estado: EstadoPedido; clienteDireccion: string }>; nextCursor: string | null };
      const list: Order[] = (data.pedidos || []).map((p) => ({
        id: p.id,
        cliente: p.clienteNombre || 'Cliente',
        items: p.items || [],
        total: p.total || 0,
        tiempo: tiempoTranscurrido(p.timestamp || 0),
        status: 'entregado' as OrderStatus,
        direccion: p.clienteDireccion || '—',
        estadoFirestore: 'entregado' as EstadoPedido,
        batchId: null,
        batchLeaderLocalId: null,
        deliveryType: 'delivery',
      }));
      if (cursor) {
        setDeliveredList((prev) => [...prev, ...list]);
      } else {
        setDeliveredList(list);
      }
      setDeliveredNextCursor(data.nextCursor ?? null);
    } catch {
      setDeliveredNextCursor(null);
    } finally {
      setDeliveredLoading(false);
    }
  }, [id, user?.rol]);

  useEffect(() => {
    if (!user || (user.rol !== 'local' && user.rol !== 'maestro') || !id) return;
    loadEntregados();
  }, [user, id, loadEntregados]);

  /** Cargar estado de batches donde este local es líder (todos listos = habilitar Pedir Rider) */
  const cargarEstadoBatch = useCallback(async (batchId: string) => {
    const token = await getIdToken();
    if (!token) return;
    try {
      const url = user?.rol === 'maestro'
        ? `/api/pedidos/batch/${encodeURIComponent(batchId)}?localId=${encodeURIComponent(id)}`
        : `/api/pedidos/batch/${encodeURIComponent(batchId)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json() as { pedidos: Array<{ estado: EstadoPedido }> };
      const pedidos = data.pedidos || [];
      const todosListos = pedidos.length > 0 && pedidos.every((p) => p.estado === 'listo');
      setBatchTodosListos((prev) => ({ ...prev, [batchId]: todosListos }));
    } catch {
      // silencioso
    }
  }, [id, user?.rol]);

  useEffect(() => {
    if (!id || orders.length === 0) return;
    const batchIdsToFetch = new Set<string>();
    orders.forEach((o) => {
      if (o.batchId && o.batchLeaderLocalId === id) batchIdsToFetch.add(o.batchId);
    });
    batchIdsToFetch.forEach((batchId) => cargarEstadoBatch(batchId));
  }, [id, orders, cargarEstadoBatch]);

  const fetchPendingTransfer = useCallback(async () => {
    if (!id) return;
    const token = await getIdToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/pedidos/pendientes-transferencia?localId=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingTransfer(Array.isArray(data) ? data : []);
      }
    } catch {
      // silencioso
    }
  }, [id]);

  useEffect(() => {
    fetchPendingTransfer();
    let t: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (t) return;
      t = setInterval(fetchPendingTransfer, 18000); // 18s - optimizado
    };
    const stopPolling = () => {
      if (t) {
        clearInterval(t);
        t = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPendingTransfer();
        startPolling();
      } else {
        stopPolling();
      }
    };
    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchPendingTransfer]);

  const refreshPendingTransfer = fetchPendingTransfer;

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  useEffect(() => {
    if (!ocupadoToast) return;
    const t = setTimeout(() => setOcupadoToast(null), 4000);
    return () => clearTimeout(t);
  }, [ocupadoToast]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (user.rol === 'local' && user.localId !== id) {
      router.replace(user.localId ? `/panel/restaurante/${user.localId}` : '/auth');
      return;
    }
    if (user.rol !== 'local' && user.rol !== 'maestro') {
      router.replace('/auth');
    }
  }, [user, loading, id, router]);

  const activeOrders = orders.filter((o) => o.status !== 'entregado' && o.status !== 'cancelado');
  const delivered = deliveredList;
  const todayEarnings = deliveredList.reduce((s, o) => s + o.total, 0);

  const tienePendientesNocturnos = activeOrders.some(() => isNightMode());

  async function advanceStatus(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order || !order.status) return;
    const cfg = STATUS_CONFIG[order.status];
    if (!cfg?.nextEstado) return;
    const token = await getIdToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/pedidos/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado: cfg.nextEstado }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== orderId) return o;
            return { ...o, status: cfg.next!, estadoFirestore: cfg.nextEstado! };
          })
        );
      }
    } catch {
      // silencioso
    }
  }

  async function marcarRetirado(orderId: string) {
    const token = await getIdToken();
    if (!token) return;
    const order = orders.find((o) => o.id === orderId);
    try {
      const res = await fetch(`/api/pedidos/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado: 'entregado' }),
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        if (order) {
          setDeliveredList((prev) => [
            { ...order, status: 'entregado', estadoFirestore: 'entregado' as EstadoPedido },
            ...prev,
          ]);
        }
      }
    } catch {
      // silencioso
    }
  }

  function onRiderSolicitado(orderId: string) {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, estadoFirestore: 'esperando_rider' as const } : o))
    );
  }

  async function handleConfirmPayment(orderId: string) {
    const token = await getIdToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/pedidos/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentConfirmed: true }),
      });
      if (res.ok) refreshPendingTransfer();
    } catch {
      // silencioso
    }
  }

  async function confirmarCancelacion() {
    if (!cancelOrderId) return;
    const token = await getIdToken();
    if (!token) return;
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/pedidos/${cancelOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accion: 'cancelar', motivo: cancelMotivo }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === cancelOrderId ? { ...o, status: 'cancelado', estadoFirestore: 'cancelado_local' as EstadoPedido } : o
          )
        );
        setCancelOrderId(null);
        setCancelMotivo('');
      }
    } catch {
      // silencioso
    } finally {
      setCancelLoading(false);
    }
  }

  async function eliminarPedido(orderId: string) {
    if (!confirm('¿Eliminar este pedido de la base de datos? No se puede deshacer.')) return;
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch(`/api/pedidos/${orderId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string };
      alert(err.error ?? 'No se pudo eliminar.');
    }
  }

  if (loading || !user || (user.rol === 'local' && user.localId !== id) || (user.rol !== 'local' && user.rol !== 'maestro')) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
      </main>
    );
  }

  if (!local) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </main>
    );
  }

  return (
    <>
      <main
        className={`min-h-screen bg-gray-50 pb-24 transition-all duration-300 ${
          pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <header className="bg-rojo-andino text-white px-5 pt-10 pb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="bg-white/25 backdrop-blur text-white font-bold text-xs px-2.5 py-1 rounded-lg">ANDINA</span>
              <span className="text-white/95 text-sm font-semibold">Panel del negocio</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-medium transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
              {permission === 'default' && (
                <button
                  type="button"
                  onClick={requestPermission}
                  disabled={notifLoading}
                  className="text-xs font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-70"
                >
                  {notifLoading ? '...' : 'Notificaciones'}
                </button>
              )}
              {permission === 'granted' && (
                <span className="text-xs text-white/70 flex items-center gap-1">
                  <Bell className="w-3.5 h-3.5" />
                  Notif. activadas
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-6 h-6 text-dorado-oro" />
            </div>
            <div>
              <h1 className="font-bold text-xl">{local.name}</h1>
              <div className="flex items-center gap-3 mt-0.5 text-white/80 text-xs">
                <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-dorado-oro fill-dorado-oro" /> {local.rating}</span>
                <span className="flex items-center gap-1"><Bell className="w-3.5 h-3.5" /> {activeOrders.length} activos</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: ShoppingBag, label: 'Pedidos hoy', value: String(activeOrders.length) },
              { icon: CheckCircle, label: 'Entregados', value: deliveredNextCursor ? `${delivered.length}+` : String(delivered.length) },
              { icon: TrendingUp, label: 'Ganado hoy', value: `$${todayEarnings.toFixed(2)}` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/20 backdrop-blur rounded-2xl p-3.5 text-center border border-white/10">
                <Icon className="w-5 h-5 text-dorado-oro mx-auto mb-1.5" />
                <p className="font-bold text-base">{value}</p>
                <p className="text-white/80 text-[11px]">{label}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="p-4 space-y-4">
          {/* No recibir pedidos (ocupado) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                <Bell className="w-4 h-4 text-amber-600" />
              </span>
              No recibir pedidos
            </h3>
            <p className="text-sm text-gray-500 mb-2 ml-10">
              Si estás saturado o tenés un inconveniente, podés pausar los pedidos. Los clientes verán &quot;Ocupado&quot; y no podrán agregar al carrito.
            </p>
            {tienePendientesNocturnos && (
              <p className="text-xs font-semibold text-red-600 mb-2 ml-10">
                Tenés pedidos nocturnos pendientes. Marcá como entregados antes de volver a aceptar nuevos pedidos.
              </p>
            )}
            {local.cerradoHasta && new Date(local.cerradoHasta).getTime() > Date.now() ? (
              <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-sm font-semibold text-amber-900">
                  Ocupado hasta {new Date(local.cerradoHasta).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  type="button"
                  disabled={ocupadoSaving || tienePendientesNocturnos}
                  onClick={async () => {
                    if (!id || ocupadoSaving) return;
                    const prevLocal = local;
                    setLocal((p) => (p ? { ...p, cerradoHasta: undefined } : null));
                    setOcupadoSaving(true);
                    setOcupadoToast(null);
                    const token = await getIdToken();
                    if (!token) {
                      setLocal(prevLocal);
                      setOcupadoSaving(false);
                      return;
                    }
                    try {
                      const res = await fetch(`/api/locales/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ cerradoHasta: null }),
                      });
                      if (!res.ok) {
                        setLocal(prevLocal);
                        setOcupadoToast('No se pudo actualizar. Revisá la conexión.');
                      }
                    } catch {
                      setLocal(prevLocal);
                      setOcupadoToast('No se pudo actualizar. Revisá la conexión.');
                    } finally {
                      setOcupadoSaving(false);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {ocupadoSaving ? '...' : 'Reabrir ya'}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {[30, 60, 90].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    disabled={ocupadoSaving || tienePendientesNocturnos}
                    onClick={async () => {
                      if (!id || ocupadoSaving) return;
                      const prevLocal = local;
                      const hasta = new Date(Date.now() + mins * 60 * 1000).toISOString();
                      setLocal((p) => (p ? { ...p, cerradoHasta: hasta } : null));
                      setOcupadoSaving(true);
                      setOcupadoToast(null);
                      const token = await getIdToken();
                      if (!token) {
                        setLocal(prevLocal);
                        setOcupadoSaving(false);
                        return;
                      }
                      try {
                        const res = await fetch(`/api/locales/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ cerradoHasta: hasta }),
                        });
                        if (!res.ok) {
                          setLocal(prevLocal);
                          setOcupadoToast('No se pudo actualizar. Revisá la conexión.');
                        }
                      } catch {
                        setLocal(prevLocal);
                        setOcupadoToast('No se pudo actualizar. Revisá la conexión.');
                      } finally {
                        setOcupadoSaving(false);
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold disabled:opacity-50 transition-colors"
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            )}
            {ocupadoToast && (
              <p className="mt-3 text-sm text-red-600 font-medium" role="alert">
                {ocupadoToast}
              </p>
            )}
          </div>

          {newOrderToast && (
            <div className="flex items-center gap-3 bg-rojo-andino text-white rounded-2xl px-4 py-3 shadow-lg animate-fade-in">
              <Bell className="w-5 h-5 text-dorado-oro flex-shrink-0 animate-bounce" />
              <div>
                <p className="font-bold text-sm">¡Nuevo pedido recibido!</p>
                <p className="text-xs text-white/80">{newOrderToast} · Pedro S.</p>
              </div>
            </div>
          )}

          {pendingTransfer.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                </span>
                Pagos por transferencia pendientes
              </h3>
              {pendingTransfer.map((order) => (
                <div
                  key={order.orderId}
                  className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-2"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-bold text-gray-900 text-sm">{order.orderNum}</span>
                      <p className="text-xs text-gray-500 mt-0.5">${order.total.toFixed(2)} · {formatDireccionCorta(order.direccion)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConfirmPayment(order.orderId)}
                      className="flex-shrink-0 text-xs font-bold px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white transition-colors"
                    >
                      Confirmar pago recibido
                    </button>
                  </div>
                  <ul className="text-xs text-gray-600 space-y-0.5 mb-3">
                    {order.items.slice(0, 3).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                    {order.items.length > 3 && (
                      <li className="text-gray-400">+{order.items.length - 3} más</li>
                    )}
                  </ul>
                  {order.comprobanteBase64 && (
                    <div className="border-t border-amber-200 pt-3 mt-2">
                      <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        Comprobante de transferencia
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.comprobanteMimeType?.startsWith('image/') ? (
                          getSafeImageSrc(order.comprobanteBase64) ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setComprobanteExpandido(order.orderId)}
                                className="rounded-xl overflow-hidden border-2 border-amber-200 bg-white shadow-sm hover:border-dorado-oro transition-colors max-w-[120px]"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={getSafeImageSrc(order.comprobanteBase64)}
                                  alt="Comprobante"
                                  className="w-full h-24 object-cover"
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => setComprobanteExpandido(order.orderId)}
                                className="text-xs font-semibold text-rojo-andino flex items-center gap-1"
                              >
                                <Expand className="w-3.5 h-3.5" />
                                Ver comprobante
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500">Comprobante no disponible</span>
                          )
                        ) : (
                          <>
                            {getSafeDataUrl(order.comprobanteBase64) ? (
                              <a
                                href={getSafeDataUrl(order.comprobanteBase64)!}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-amber-200 text-sm font-semibold text-gray-800 hover:bg-amber-50"
                              >
                                <FileText className="w-4 h-4 text-red-600" />
                                {order.comprobanteFileName || 'Ver PDF'}
                              </a>
                            ) : (
                              <span className="text-xs text-gray-500">Comprobante no disponible</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setComprobanteExpandido(order.orderId)}
                              className="text-xs font-semibold text-rojo-andino flex items-center gap-1"
                            >
                              <Expand className="w-3.5 h-3.5" />
                              Abrir en pantalla completa
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {comprobanteExpandido && (() => {
                const order = pendingTransfer.find((o) => o.orderId === comprobanteExpandido);
                if (!order?.comprobanteBase64) return null;
                const safeComprobanteUrl = getSafeDataUrl(order.comprobanteBase64);
                const isPdf = order.comprobanteMimeType === 'application/pdf';
                return (
                  <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setComprobanteExpandido(null)}
                  >
                    <div
                      className="bg-white rounded-2xl overflow-hidden max-w-full max-h-[90vh] w-full flex flex-col"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between p-3 border-b border-gray-100">
                        <span className="font-bold text-gray-900 text-sm">{order.orderNum} – Comprobante</span>
                        <button
                          type="button"
                          onClick={() => setComprobanteExpandido(null)}
                          className="p-2 rounded-xl hover:bg-gray-100"
                        >
                          <X className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto p-2 min-h-[200px]">
                        {isPdf && safeComprobanteUrl ? (
                          <iframe
                            src={safeComprobanteUrl}
                            title="Comprobante PDF"
                            className="w-full h-[70vh] rounded-lg border border-gray-200"
                          />
                        ) : !isPdf && getSafeImageSrc(order.comprobanteBase64) ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={getSafeImageSrc(order.comprobanteBase64)}
                            alt="Comprobante de transferencia"
                            className="max-w-full h-auto mx-auto rounded-lg"
                          />
                        ) : (
                          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">Comprobante no disponible</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {activeOrders.length === 0 && pendingTransfer.length === 0 && !ordersLoading && (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-semibold text-gray-500">Sin pedidos activos</p>
              <p className="text-sm text-gray-400 mt-1">Los nuevos pedidos aparecerán aquí</p>
            </div>
          )}

          {ordersLoading && activeOrders.length === 0 && (
            <SkeletonListaPedidos />
          )}

          {(() => {
            const porEstado = {
              nuevo: activeOrders.filter((o) => o.status === 'nuevo'),
              preparando: activeOrders.filter((o) => o.status === 'preparando'),
              listo: activeOrders.filter((o) => o.status === 'listo'),
            };
            const secciones: { key: OrderStatus; orders: Order[] }[] = [
              { key: 'nuevo', orders: porEstado.nuevo },
              { key: 'preparando', orders: porEstado.preparando },
              { key: 'listo', orders: porEstado.listo },
            ].filter((s) => s.orders.length > 0) as { key: OrderStatus; orders: Order[] }[];

            return secciones.map(({ key, orders: list }) => {
              const cfg = STATUS_CONFIG[key];
              return (
                <div key={key} className="mb-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${key === 'nuevo' ? 'bg-blue-500' : key === 'preparando' ? 'bg-amber-500' : 'bg-green-500'}`} />
                    {cfg.label}
                    <span className="text-gray-400 font-normal text-xs">({list.length})</span>
                  </h3>
                  <div className="space-y-3">
                    {list.map((order) => {
                      const orderCfg = STATUS_CONFIG[order.status];
                      return (
                        <div
                          key={order.id}
                          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-gray-200 animate-fade-in"
                        >
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-gray-900">{order.id}</span>
                                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${orderCfg.bg} ${orderCfg.color}`}>
                                    {orderCfg.label}
                                  </span>
                                  {order.deliveryType === 'pickup' && (
                                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border bg-amber-50 border-amber-200 text-amber-800">
                                      Retiro en local
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-1.5">{order.cliente} · {order.tiempo}</p>
                              </div>
                              <span className="font-black text-rojo-andino text-lg flex-shrink-0">${order.total.toFixed(2)}</span>
                            </div>
                            <ul className="text-sm text-gray-600 mb-4 space-y-1.5">
                              {order.items.map((item) => (
                                <li key={item} className="flex items-start gap-2">
                                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-gray-50">
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Truck className="w-4 h-4 text-dorado-oro" />
                                <span className="truncate max-w-[180px]">{order.deliveryType === 'pickup' ? 'Retiro en local' : formatDireccionCorta(order.direccion)}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {order.deliveryType === 'pickup' && order.status === 'listo' && (
                                  <button
                                    type="button"
                                    onClick={() => marcarRetirado(order.id)}
                                    className="text-xs font-bold px-4 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Marcar como retirado
                                  </button>
                                )}
                                {order.deliveryType !== 'pickup' && order.status === 'listo' && order.estadoFirestore === 'esperando_rider' && (
                                  <span className="text-xs font-semibold px-3 py-2 rounded-xl bg-amber-100 text-amber-800">
                                    Esperando confirmación
                                  </span>
                                )}
                                {order.deliveryType !== 'pickup' && order.status === 'listo' && order.estadoFirestore !== 'esperando_rider' && (!order.batchId || order.batchLeaderLocalId === id) && (
                                  <BotonPedirRider
                                    orderId={order.id}
                                    direccion={order.direccion}
                                    restaurante={local.name}
                                    onSolicitado={() => onRiderSolicitado(order.id)}
                                    esBatchLeader={!order.batchId || order.batchLeaderLocalId === id}
                                    todosListosEnBatch={!order.batchId || batchTodosListos[order.batchId] !== false}
                                  />
                                )}
                                {orderCfg.next && (
                                  <button
                                    type="button"
                                    onClick={() => advanceStatus(order.id)}
                                    className={`text-xs font-bold px-4 py-2.5 rounded-xl transition-colors ${
                                      order.status === 'nuevo' ? 'bg-rojo-andino text-white hover:bg-rojo-andino/90' :
                                      order.status === 'preparando' ? 'bg-dorado-oro text-gray-900 hover:bg-dorado-oro/90' :
                                      'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                                  >
                                    {orderCfg.nextLabel}
                                  </button>
                                )}
                                {(order.status === 'nuevo' || order.status === 'preparando') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCancelOrderId(order.id);
                                      setCancelMotivo('');
                                    }}
                                    className="text-xs font-bold px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                                  >
                                    Cancelar pedido
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => eliminarPedido(order.id)}
                                  className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors"
                                  title="Eliminar pedido de la base de datos (pruebas/bugeado)"
                                  aria-label="Eliminar pedido"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}

          {(delivered.length > 0 || deliveredLoading) && (
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                Entregados
                <span className="text-gray-400 font-normal text-xs">
                  {deliveredLoading && delivered.length === 0 ? '(cargando...)' : `(${deliveredNextCursor ? `${delivered.length}+` : delivered.length})`}
                </span>
              </h3>
              {deliveredLoading && delivered.length === 0 ? (
                <SkeletonListaPedidos />
              ) : (
                <>
                  <div className="space-y-2">
                    {delivered.map((order) => (
                      <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between shadow-sm hover:border-gray-200 transition-colors">
                        <div>
                          <span className="font-semibold text-gray-900">{order.id}</span>
                          <p className="text-sm text-gray-500 mt-0.5">{order.cliente} · ${order.total.toFixed(2)}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {deliveredNextCursor && (
                    <button
                      type="button"
                      onClick={() => loadEntregados(deliveredNextCursor)}
                      disabled={deliveredLoading}
                      className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 disabled:opacity-60"
                    >
                      {deliveredLoading ? 'Cargando...' : 'Ver más entregados'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </main>
      <ModalCerrarSesion
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => {
          setShowLogoutModal(false);
          logout().then(() => router.replace('/auth'));
        }}
      />
      {cancelOrderId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl">
            <h2 className="font-black text-gray-900 text-lg mb-2">Cancelar pedido</h2>
            <p className="text-sm text-gray-600 mb-3">
              ¿Seguro que deseas cancelar este pedido? El cliente será notificado y no se asignará rider.
            </p>
            <label className="block mb-3">
              <span className="text-xs font-semibold text-gray-500">Motivo (opcional)</span>
              <textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-rojo-andino"
                placeholder="Ej: Cliente llamó para cancelar, problema con stock, etc."
              />
            </label>
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  if (cancelLoading) return;
                  setCancelOrderId(null);
                  setCancelMotivo('');
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
                disabled={cancelLoading}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={confirmarCancelacion}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-70"
                disabled={cancelLoading}
              >
                {cancelLoading ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
      <NavPanel />
    </>
  );
}
