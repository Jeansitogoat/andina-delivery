'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { getIdToken } from '@/lib/authToken';
import {
  ArrowLeft,
  Bike,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Package,
  X,
  Search,
  Bell,
  History,
  Users,
  UserCheck,
  Zap,
  Navigation,
  Check,
  Filter,
  RefreshCw,
  ShoppingBag,
  LogOut,
  Trash2,
  DollarSign,
  Truck,
} from 'lucide-react';
import Image from 'next/image';
import { useNotifications } from '@/lib/useNotifications';
import { sendNotification } from '@/lib/notifications';
import { useAuth } from '@/lib/useAuth';
import type { EstadoPedido, EstadoRider, PedidoCentral, RiderCentral } from '@/lib/types';
import ModalCerrarSesion from '@/components/panel/ModalCerrarSesion';
import { getSafeImageSrc } from '@/lib/validImageUrl';
import SkeletonListaPedidos from '@/components/SkeletonListaPedidos';
import { useToast } from '@/lib/ToastContext';
import { LoadingButton } from '@/components/LoadingButton';
import { useAndinaConfig } from '@/lib/AndinaContext';

/* ─────────────── config y utils ─────────────── */
const ESTADO_RIDER_CONFIG: Record<EstadoRider, { label: string; dot: string; bg: string }> = {
  disponible:     { label: 'Disponible',       dot: 'bg-green-400',  bg: 'bg-green-50 border-green-200 text-green-700' },
  ocupado:        { label: 'Ocupado',           dot: 'bg-yellow-400', bg: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  ausente:        { label: 'Ausente',           dot: 'bg-orange-400', bg: 'bg-orange-50 border-orange-200 text-orange-700' },
  fuera_servicio: { label: 'Fuera de servicio', dot: 'bg-red-400',    bg: 'bg-red-50 border-red-200 text-red-700' },
};

const ESTADO_PEDIDO_CONFIG: Record<EstadoPedido, { label: string; color: string; bg: string }> = {
  confirmado:      { label: 'Confirmado',        color: 'text-gray-600',  bg: 'bg-gray-50 border-gray-200' },
  preparando:      { label: 'En preparación',    color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  listo:           { label: 'Listo',             color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  esperando_rider: { label: 'Esperando rider',  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  asignado:        { label: 'Rider asignado',   color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
  en_camino:       { label: 'En camino',         color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  entregado:       { label: 'Entregado',         color: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
  cancelado_local: { label: 'Cancelado por local', color: 'text-red-600',  bg: 'bg-red-50 border-red-200' },
  cancelado_cliente: { label: 'Cancelado por cliente', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

const PANEL_CENTRAL_KEYFRAMES = `
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translate(-50%, 12px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(251,146,60,0.5); }
    70% { box-shadow: 0 0 0 8px rgba(251,146,60,0); }
    100% { box-shadow: 0 0 0 0 rgba(251,146,60,0); }
  }
`;

/* ─────────────── utils ─────────────── */
function tiempoTranscurrido(timestamp: number): string {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return 'justo ahora';
  if (mins < 60) return `hace ${mins} min`;
  return `hace ${Math.floor(mins / 60)}h ${mins % 60}min`;
}

/* ─────────────── componente principal ─────────────── */
export default function PanelCentralPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { permission, requestPermission, loading: notifLoading } = useNotifications('central');
  const [pedidos, setPedidos] = useState<PedidoCentral[]>([]);
  const [riders, setRiders] = useState<RiderCentral[]>([]);
  const [tab, setTab] = useState<'activos' | 'riders' | 'historial' | 'tarifas'>('activos');
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<PedidoCentral | null>(null);
  const [mostrarAsignar, setMostrarAsignar] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoPedido | 'todos'>('todos');
  const [pageVisible, setPageVisible] = useState(false);
  const [toast, setToast] = useState('');
  const [nuevoPedidoId, setNuevoPedidoId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [filtroHistorial, setFiltroHistorial] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const prevPedidosCount = useRef(0);
  const [sessionInvalid, setSessionInvalid] = useState(false);
  const [tarifasTiers, setTarifasTiers] = useState<Array<{ kmMax: number | null; tarifa: number }>>([
    { kmMax: 2.5, tarifa: 1.5 },
    { kmMax: 5, tarifa: 2.5 },
    { kmMax: null, tarifa: 3.5 },
  ]);
  const [tarifasPorParada, setTarifasPorParada] = useState(0.25);
  const [loadingTarifas, setLoadingTarifas] = useState(false);
  const [guardandoTarifas, setGuardandoTarifas] = useState(false);
  const [asignandoKey, setAsignandoKey] = useState<string | null>(null);
  const [avanzandoId, setAvanzandoId] = useState<string | null>(null);

  const [showLimpiarModal, setShowLimpiarModal] = useState(false);
  const [confirmacionLimpiar, setConfirmacionLimpiar] = useState('');
  const [loadingLimpiar, setLoadingLimpiar] = useState(false);

  const [eliminarPedidoId, setEliminarPedidoId] = useState<string | null>(null);

  const { showToast: showGlobalToast } = useToast();
  const { config: andinaConfig, refreshConfig } = useAndinaConfig();
  const newOrderSound = useRef<HTMLAudioElement | null>(null);
  function playNewOrderSound() {
    try {
      if (!newOrderSound.current) newOrderSound.current = new Audio('/sounds/central-new-order.mp3');
      newOrderSound.current.volume = 1.0;
      newOrderSound.current.play().catch(() => {});
    } catch {
      // ignorar
    }
  }

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || (user.rol !== 'central' && user.rol !== 'maestro')) {
      router.replace('/auth');
    }
  }, [user, loading, router]);

  /* Cargar tarifas cuando se abre la pestaña Tarifas (desde AndinaContext) */
  useEffect(() => {
    if (tab !== 'tarifas') return;
    setLoadingTarifas(true);
    const cfg = andinaConfig.tarifas;
    if (Array.isArray(cfg.tiers) && cfg.tiers.length > 0) {
      setTarifasTiers(cfg.tiers);
    }
    setTarifasPorParada(cfg.porParadaAdicional);
    setLoadingTarifas(false);
  }, [tab, andinaConfig]);

  const guardarTarifas = useCallback(async () => {
    const tok = await getIdToken();
    if (!tok) return;
    setGuardandoTarifas(true);
    try {
      const res = await fetch('/api/config/tarifas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ tiers: tarifasTiers, porParadaAdicional: tarifasPorParada }),
      });
      if (res.ok) {
        showToast('Tarifas guardadas');
        // Refrescar config global para que AndinaContext se actualice
        refreshConfig().catch(() => {});
      } else {
        showToast('Error al guardar');
      }
    } catch {
      showToast('Error al guardar');
    } finally {
      setGuardandoTarifas(false);
    }
  }, [tarifasTiers, tarifasPorParada, refreshConfig]);

  /* Cargar pedidos y riders (token fresco en cada llamada) */
  const cargarDatos = useCallback(async (filtro?: 'hoy' | 'semana' | 'mes') => {
    const tok = await getIdToken();
    if (!tok) return;
    setLoadingData(true);
    const f = filtro ?? filtroHistorial;
    try {
      const res = await fetch(`/api/central?filtro=${f}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.status === 401) {
        setSessionInvalid(true);
        return;
      }
      if (!res.ok) return;
      const data = await res.json() as { pedidos: PedidoCentral[]; riders: RiderCentral[] };
      if (Array.isArray(data.pedidos)) {
        const estadosVisiblesCentral: EstadoPedido[] = ['esperando_rider', 'asignado', 'en_camino', 'entregado'];
        const pedidosCentral = data.pedidos.filter((p) =>
          estadosVisiblesCentral.includes((p.estado || 'confirmado') as EstadoPedido)
        );
        const nuevosEsperando = pedidosCentral.filter((p) => p.estado === 'esperando_rider').length;
        if (nuevosEsperando > 0 && pedidosCentral.length > prevPedidosCount.current) {
          const nuevo = pedidosCentral.find((p) => p.estado === 'esperando_rider');
          if (nuevo) {
            setNuevoPedidoId(nuevo.id);
            showToast('Nuevo pedido: ' + nuevo.restaurante + ' · ' + nuevo.clienteNombre);
            sendNotification({ target: 'central', title: 'Nueva carrera', body: nuevo.restaurante + ' · ' + nuevo.clienteNombre });
            playNewOrderSound();
            setTimeout(() => setNuevoPedidoId(null), 4000);
          }
        }
        prevPedidosCount.current = pedidosCentral.length;
        setPedidos(pedidosCentral);
      }
      if (Array.isArray(data.riders)) setRiders(data.riders);
    } catch {
      // silencioso
    } finally {
      setLoadingData(false);
    }
  }, [filtroHistorial]);

  useEffect(() => {
    if (!user) return;
    if (sessionInvalid) {
      router.replace('/auth');
      return;
    }
    cargarDatos();
    let t: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (t) return;
      // 60s: reduce a la mitad las lecturas del panel central vs 30s previos
      t = setInterval(cargarDatos, 60_000);
    };
    const stopPolling = () => {
      if (t) {
        clearInterval(t);
        t = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        cargarDatos();
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
  }, [user, filtroHistorial, cargarDatos, sessionInvalid, router]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }

  /* asignar rider a pedido */
  async function asignarRider(pedidoId: string, riderId: string, batchId?: string | null) {
    const key = `${pedidoId}_${riderId}`;
    setAsignandoKey(key);
    const prevPedidos = pedidos;
    const prevRiders = riders;
    // Actualización optimista
    setPedidos((prev) => {
      if (batchId) {
        return prev.map((p) =>
          p.batchId === batchId ? { ...p, estado: 'asignado', riderId } : p
        );
      }
      return prev.map((p) => (p.id === pedidoId ? { ...p, estado: 'asignado', riderId } : p));
    });
    setRiders((prev) =>
      prev.map((r) => r.id === riderId ? { ...r, estado: 'ocupado' } : r)
    );
    const rider = riders.find((r) => r.id === riderId);
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (batchId) {
      const paradas = pedidos.filter((p) => p.batchId === batchId);
      const resumenRuta = paradas
        .slice()
        .sort((a, b) => (a.batchIndex ?? 0) - (b.batchIndex ?? 0))
        .map((p) => p.restaurante)
        .join(' → ');
      showToast(`✅ ${rider?.nombre} asignado a ruta multi-stop: ${resumenRuta}`);
    } else {
      showToast(`✅ ${rider?.nombre} asignado a pedido de ${pedido?.clienteNombre}`);
    }
    sendNotification({
      target: 'rider',
      uid: riderId,
      title: 'Nueva carrera asignada',
      body: `${pedido?.restaurante} · ${pedido?.clienteNombre} · $` + (pedido?.total.toFixed(2) ?? '0.00'),
    });
    setMostrarAsignar(false);
    setPedidoSeleccionado(null);
    // Persistir en Firestore
    const tok = await getIdToken();
    try {
      if (!tok) {
        setPedidos(prevPedidos);
        setRiders(prevRiders);
        showToast('No se pudo asignar. Revisá la sesión.');
        return;
      }
      const url = batchId
        ? `/api/pedidos/batch/${encodeURIComponent(batchId)}/asignar`
        : `/api/pedidos/${pedidoId}`;
      const body = batchId
        ? JSON.stringify({ riderId })
        : JSON.stringify({ estado: 'asignado', riderId });
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body,
      });
      if (!res.ok) {
        setPedidos(prevPedidos);
        setRiders(prevRiders);
        showToast('No se pudo asignar. Revisá la conexión.');
        showGlobalToast({ type: 'error', message: res.status === 403 ? 'No tenés permiso para esta acción.' : '¡Ups! El internet se fue a dar una vuelta. Reintenta en un momento.' });
      }
    } catch {
      setPedidos(prevPedidos);
      setRiders(prevRiders);
      showToast('No se pudo asignar. Revisá la conexión.');
      showGlobalToast({ type: 'error', message: '¡Ups! El internet se fue a dar una vuelta. Reintenta en un momento.' });
    } finally {
      setAsignandoKey(null);
    }
  }

  /* avanzar estado manualmente */
  async function avanzarEstado(pedidoId: string) {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return;
    const siguiente: Record<EstadoPedido, EstadoPedido> = {
      confirmado: 'confirmado',
      preparando: 'preparando',
      listo: 'listo',
      esperando_rider: 'esperando_rider',
      asignado: 'en_camino',
      en_camino: 'entregado',
      entregado: 'entregado',
      cancelado_local: 'cancelado_local',
      cancelado_cliente: 'cancelado_cliente',
    };
    const nuevoEstado = siguiente[pedido.estado];
    if (nuevoEstado === pedido.estado) return;
    setAvanzandoId(pedidoId);
    const prevPedidos = pedidos;
    // Actualización optimista
    setPedidos((prev) =>
      prev.map((p) => p.id !== pedidoId ? p : { ...p, estado: nuevoEstado })
    );
    try {
      const tok = await getIdToken();
      if (!tok) {
        setPedidos(prevPedidos);
        showToast('No se pudo avanzar. Revisá la sesión.');
        return;
      }
      const res = await fetch(`/api/pedidos/${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!res.ok) {
        setPedidos(prevPedidos);
        showToast('No se pudo avanzar. Revisá la conexión.');
        showGlobalToast({ type: 'error', message: res.status === 403 ? 'No tenés permiso para esta acción.' : '¡Ups! El internet se fue a dar una vuelta. Reintenta en un momento.' });
      }
    } catch {
      setPedidos(prevPedidos);
      showToast('No se pudo avanzar. Revisá la conexión.');
      showGlobalToast({ type: 'error', message: '¡Ups! El internet se fue a dar una vuelta. Reintenta en un momento.' });
    } finally {
      setAvanzandoId(null);
    }
  }

  async function eliminarPedido(pedidoId: string) {
    const tok = await getIdToken();
    if (!tok) return;
    const res = await fetch(`/api/pedidos/${pedidoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (res.ok) {
      setPedidos((prev) => prev.filter((p) => p.id !== pedidoId));
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string };
      showGlobalToast({ type: 'error', message: err.error ?? 'No se pudo eliminar el pedido.' });
    }
  }

  async function limpiarTodosPedidos() {
    if (user?.rol !== 'maestro') return;
    const tok = await getIdToken();
    if (!tok) return;
    setLoadingLimpiar(true);
    try {
      const res = await fetch('/api/maestro/limpiar-pedidos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.ok) {
        const data = await res.json() as { eliminados?: number };
        setPedidos([]);
        setShowLimpiarModal(false);
        setConfirmacionLimpiar('');
        showGlobalToast({ type: 'success', message: `Se eliminaron ${data.eliminados ?? 0} pedidos.` });
      } else {
        const err = await res.json().catch(() => ({})) as { error?: string };
        showGlobalToast({ type: 'error', message: err.error ?? 'Error al limpiar.' });
      }
    } catch {
      showGlobalToast({ type: 'error', message: 'Error al limpiar.' });
    } finally {
      setLoadingLimpiar(false);
    }
  }

  /* stats */
  const esperando = pedidos.filter((p) => p.estado === 'esperando_rider').length;
  const enCurso = pedidos.filter((p) => p.estado === 'asignado' || p.estado === 'en_camino').length;
  const entregadosHoy = pedidos.filter((p) => p.estado === 'entregado').length;
  const ridersDisponibles = riders.filter((r) => r.estado === 'disponible').length;

  /* filtros */
  const pedidosFiltrados = useMemo(() => pedidos.filter((p) => {
    const coincideBusqueda =
      busqueda === '' ||
      p.clienteNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.restaurante.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.id.includes(busqueda);
    const coincideEstado = filtroEstado === 'todos' || p.estado === filtroEstado;
    return coincideBusqueda && coincideEstado;
  }), [pedidos, busqueda, filtroEstado]);

  const pedidosActivos = useMemo(() => pedidosFiltrados.filter(
    (p) => p.estado !== 'entregado' && p.estado !== 'cancelado_local' && p.estado !== 'cancelado_cliente'
  ), [pedidosFiltrados]);
  const pedidosHistorial = useMemo(() => pedidosFiltrados.filter(
    (p) => p.estado === 'entregado' || p.estado === 'cancelado_local' || p.estado === 'cancelado_cliente'
  ), [pedidosFiltrados]);

  if (loading || !user || (user.rol !== 'central' && user.rol !== 'maestro')) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Cargando panel central...</p>
      </main>
    );
  }

  function PanelCentralContent() {
    return (
      <>
        <main
          className={'min-h-screen bg-gray-50 pb-6 transition-all duration-300 ' + (pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2')}
        >
          <header
            className="text-white px-4 pt-10 pb-6"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 60%, #5b21b6 100%)' }}
          >
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-5">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-medium transition-colors"
                    title="Ir como cliente"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span className="hidden sm:inline">Ir a pedir</span>
                  </button>
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
                      {notifLoading ? '...' : 'Activar notificaciones'}
                    </button>
                  )}
                  {permission === 'granted' && (
                    <span className="text-xs text-white/70 flex items-center gap-1">
                      <Bell className="w-3.5 h-3.5" />
                      Notificaciones activadas
                    </span>
                  )}
                  {esperando > 0 && (
                    <div className="flex items-center gap-1.5 bg-orange-400/30 border border-orange-300/40 px-3 py-1.5 rounded-xl">
                      <Bell className="w-4 h-4 text-orange-200 animate-bounce" />
                      <span className="text-xs font-bold text-orange-100">{esperando} sin rider</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="font-black text-xl">Panel Central</h1>
                    <p className="text-white/70 text-sm">Cía. Virgen de la Merced · Piñas</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/panel/central/validaciones')}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                  Validaciones
                </button>
                {user?.rol === 'maestro' && (
                  <button
                    type="button"
                    onClick={() => setShowLimpiarModal(true)}
                    className="flex items-center gap-2 bg-red-500/30 hover:bg-red-500/50 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors border border-red-300/40"
                    title="Borrar todos los pedidos (dejar paneles como nuevos)"
                  >
                    <Trash2 className="w-4 h-4" />
                    Limpiar pedidos
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => cargarDatos()}
                  disabled={loadingData}
                  className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center disabled:opacity-60"
                  title="Actualizar"
                >
                  <RefreshCw className={'w-4 h-4 text-white ' + (loadingData ? 'animate-spin' : '')} />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Esperando', value: esperando, icon: AlertCircle, alert: esperando > 0 },
                  { label: 'En curso', value: enCurso, icon: Bike, alert: false },
                  { label: 'Entregados', value: entregadosHoy, icon: CheckCircle2, alert: false },
                  { label: 'Riders disp.', value: ridersDisponibles, icon: Users, alert: false },
                ].map(({ label, value, icon: Icon, alert }) => (
                  <div
                    key={label}
                    className={'rounded-2xl p-2.5 text-center ' + (alert ? 'bg-orange-400/25 border border-orange-300/30' : 'bg-white/15')}
                  >
                    <Icon className={'w-4 h-4 mx-auto mb-1 ' + (alert ? 'text-orange-200' : 'text-white/70')} />
                    <p className={'font-black text-lg leading-tight ' + (alert ? 'text-orange-100' : 'text-white')}>{value}</p>
                    <p className="text-[10px] text-white/50 leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </header>

          <div className="max-w-2xl mx-auto px-4 mt-4">
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar pedido, cliente, restaurante..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:border-purple-400 transition-colors"
                />
              </div>
              <div className="relative">
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value as EstadoPedido | 'todos')}
                  className="appearance-none bg-white border border-gray-200 rounded-2xl pl-3 pr-8 py-2.5 text-sm outline-none focus:border-purple-400 transition-colors"
                >
                  <option value="todos">Todos</option>
                  <option value="esperando_rider">Sin rider</option>
                  <option value="asignado">Asignado</option>
                  <option value="en_camino">En camino</option>
                  <option value="entregado">Entregado</option>
                </select>
                <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-1 flex shadow-sm mb-4 overflow-x-auto">
              {[
                { id: 'activos', label: 'Activos (' + pedidosActivos.length + ')', icon: Package },
                { id: 'riders', label: 'Riders (' + riders.length + ')', icon: Bike },
                { id: 'historial', label: 'Historial (' + pedidosHistorial.length + ')', icon: History },
                { id: 'tarifas', label: 'Tarifas', icon: Truck },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id as 'activos' | 'riders' | 'historial' | 'tarifas')}
                  className={'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all min-w-[80px] ' + (tab === id ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600')}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {tab === 'activos' && (
              <div className="space-y-3">
                {loadingData && pedidos.length === 0 ? (
                  <SkeletonListaPedidos />
                ) : pedidosActivos.length === 0 ? (
                  <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
                    <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="font-bold text-gray-400">No hay pedidos activos</p>
                  </div>
                ) : (
                  pedidosActivos
                    .slice()
                    .sort((a, b) => {
                      const orden: Record<EstadoPedido, number> = {
                        confirmado: 0,
                        preparando: 1,
                        listo: 2,
                        esperando_rider: 3,
                        asignado: 4,
                        en_camino: 5,
                        entregado: 6,
                        cancelado_local: 7,
                        cancelado_cliente: 8,
                      };
                      return orden[a.estado] - orden[b.estado];
                    })
                    .map((pedido) => {
                      const esMultiStop = !!pedido.batchId;
                      const totalParadas = esMultiStop
                        ? pedidosActivos.filter((p) => p.batchId === pedido.batchId).length
                        : null;
                      const numeroParada = esMultiStop
                        ? ((pedido.batchIndex ?? 0) + 1)
                        : null;
                      return (
                        <TarjetaPedidoCentral
                          key={pedido.id}
                          pedido={pedido}
                          riders={riders}
                          isNuevo={pedido.id === nuevoPedidoId}
                          esMultiStop={esMultiStop}
                          numeroParada={numeroParada}
                          totalParadas={totalParadas}
                          avanzandoId={avanzandoId}
                          asignandoKey={asignandoKey}
                          onAsignar={() => {
                            setPedidoSeleccionado(pedido);
                            setMostrarAsignar(true);
                          }}
                          onVerDetalle={() => setPedidoSeleccionado(pedido)}
                          onAvanzar={() => avanzarEstado(pedido.id)}
                          onEliminar={() => setEliminarPedidoId(pedido.id)}
                        />
                      );
                    })
                )}
              </div>
            )}

            {tab === 'riders' && (
              <div className="space-y-3">
                <div className="bg-white rounded-3xl p-4 shadow-sm">
                  <p className="text-xs font-semibold text-gray-400 mb-3">RESUMEN DE FLOTA</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['disponible', 'ocupado', 'ausente', 'fuera_servicio'] as EstadoRider[]).map((estado) => {
                      const count = riders.filter((r) => r.estado === estado).length;
                      const cfg = ESTADO_RIDER_CONFIG[estado];
                      return (
                        <div key={estado} className={'rounded-2xl border p-3 flex items-center gap-3 ' + cfg.bg}>
                          <div className={'w-2.5 h-2.5 rounded-full ' + cfg.dot + ' flex-shrink-0'} />
                          <div>
                            <p className="font-bold text-sm">{count}</p>
                            <p className="text-xs opacity-70">{cfg.label}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {riders.map((rider) => {
                  const cfg = ESTADO_RIDER_CONFIG[rider.estado];
                  const carreraActual = pedidos.find((p) => p.riderId === rider.id && p.estado !== 'entregado');
                  return (
                    <div key={rider.id} className="bg-white rounded-3xl p-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        {getSafeImageSrc(rider.photoURL) ? (
                          <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-200 relative">
                            <Image
                              src={getSafeImageSrc(rider.photoURL)!}
                              alt={rider.nombre}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className={'w-12 h-12 rounded-2xl ' + rider.color + ' flex items-center justify-center text-white font-black text-lg flex-shrink-0'}>
                            {rider.inicial}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900">{rider.nombre}</p>
                            <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full border ' + cfg.bg}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">{rider.carrerasHoy} carreras hoy · ⭐ {rider.calificacion}</p>
                        </div>
                        <a
                          href={'tel:' + rider.telefono}
                          className="w-9 h-9 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center hover:bg-green-100 transition-colors flex-shrink-0"
                        >
                          <Phone className="w-4 h-4 text-green-600" />
                        </a>
                      </div>

                      {carreraActual && (
                        <div className="bg-gray-50 rounded-2xl p-3 flex items-start gap-2.5">
                          <Bike className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-700 truncate">
                              {carreraActual.restaurante} → {carreraActual.clienteNombre}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{carreraActual.clienteDireccion}</p>
                            <span className={'inline-flex items-center gap-1 text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full border ' + ESTADO_PEDIDO_CONFIG[carreraActual.estado].bg + ' ' + ESTADO_PEDIDO_CONFIG[carreraActual.estado].color}>
                              {ESTADO_PEDIDO_CONFIG[carreraActual.estado].label}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'tarifas' && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-4 shadow-sm">
                  <p className="text-xs font-semibold text-gray-400 mb-3">TARIFAS DE ENVÍO POR DISTANCIA</p>
                  <p className="text-sm text-gray-600 mb-4">Estos valores se usan en la app para calcular el costo de envío según la distancia del cliente al restaurante.</p>
                  {loadingTarifas ? (
                    <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div>
                  ) : (
                    <div className="space-y-3">
                      {tarifasTiers.map((tier, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="flex-1 flex gap-2">
                            <div className="flex-1">
                              <label className="text-xs text-gray-500 block mb-1">Hasta (km)</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={tier.kmMax ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setTarifasTiers((prev) => {
                                    const n = [...prev];
                                    n[idx] = { ...tier, kmMax: v === '' ? null : parseFloat(v) };
                                    return n;
                                  });
                                }}
                                placeholder="Sin límite"
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-xs text-gray-500 block mb-1">Precio ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tier.tarifa}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  setTarifasTiers((prev) => {
                                    const n = [...prev];
                                    n[idx] = { ...tier, tarifa: Number.isNaN(v) ? 0 : v };
                                    return n;
                                  });
                                }}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                          </div>
                          {tier.kmMax == null && (
                            <span className="text-xs text-gray-400 mt-6">(más de {tarifasTiers[idx - 1]?.kmMax ?? '0'} km)</span>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center gap-3 pt-2">
                        <label className="text-sm font-semibold text-gray-700">Por parada adicional ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tarifasPorParada}
                          onChange={(e) => setTarifasPorParada(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-xs text-gray-400">Se suma por cada local extra en el pedido</span>
                      </div>
                      <button
                        type="button"
                        onClick={guardarTarifas}
                        disabled={guardandoTarifas}
                        className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <DollarSign className="w-5 h-5" />
                        {guardandoTarifas ? 'Guardando...' : 'Guardar tarifas'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'historial' && (
              <div className="space-y-3">
                <div className="flex gap-2 mb-2">
                  {(['hoy', 'semana', 'mes'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFiltroHistorial(f)}
                      className={'px-3 py-2 rounded-xl text-xs font-semibold transition-colors ' + (filtroHistorial === f ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}
                    >
                      {f === 'hoy' ? 'Hoy' : f === 'semana' ? 'Semana' : 'Mes'}
                    </button>
                  ))}
                </div>
                <div className="bg-white rounded-3xl p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">
                      Entregas completadas{filtroHistorial === 'hoy' ? ' hoy' : filtroHistorial === 'semana' ? ' esta semana' : ' este mes'}
                    </p>
                    <p className="font-black text-3xl text-purple-600">{pedidosHistorial.length}</p>
                  </div>
                </div>

                {pedidosHistorial.length === 0 ? (
                  <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
                    <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="font-bold text-gray-400">Sin entregas aún</p>
                  </div>
                ) : (
                  pedidosHistorial.map((p) => {
                    const rider = riders.find((r) => r.id === p.riderId);
                    return (
                      <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className="font-bold text-sm text-gray-900 truncate">{p.clienteNombre}</p>
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{p.hora}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{p.restaurante} → {p.clienteDireccion}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {rider && (
                              <span className="text-xs text-blue-600 font-semibold">{rider.nombre}</span>
                            )}
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs font-bold text-gray-700">${p.total.toFixed(2)}</span>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{p.distancia}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
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

        {showLimpiarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
              <h2 className="font-black text-gray-900 text-lg mb-2">Borrar todos los pedidos</h2>
              <p className="text-sm text-gray-600 mb-4">
                Los paneles quedarán vacíos. Esta acción no se puede deshacer.
              </p>
              <input
                type="text"
                value={confirmacionLimpiar}
                onChange={(e) => setConfirmacionLimpiar(e.target.value)}
                placeholder="Escribí ELIMINAR para confirmar"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-red-500"
                disabled={loadingLimpiar}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => { setShowLimpiarModal(false); setConfirmacionLimpiar(''); }}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
                  disabled={loadingLimpiar}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => limpiarTodosPedidos()}
                  disabled={confirmacionLimpiar.trim().toUpperCase() !== 'ELIMINAR' || loadingLimpiar}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingLimpiar ? 'Eliminando...' : 'Eliminar todo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {eliminarPedidoId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
              <h2 className="font-black text-gray-900 text-lg mb-2">Eliminar pedido</h2>
              <p className="text-sm text-gray-600 mb-4">
                ¿Eliminar este pedido? Se borrará de la base de datos. Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEliminarPedidoId(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    eliminarPedido(eliminarPedidoId);
                    setEliminarPedidoId(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {pedidoSeleccionado && !mostrarAsignar && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50">
            <div
              className="bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto"
              style={{ animation: 'slideUp 0.3s ease forwards' }}
            >
              <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-gray-900">Pedido #{pedidoSeleccionado.id}</h3>
                  <p className="text-xs text-gray-400">{tiempoTranscurrido(pedidoSeleccionado.timestamp)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPedidoSeleccionado(null)}
                  className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className={'flex items-center gap-2 px-4 py-2.5 rounded-2xl border ' + ESTADO_PEDIDO_CONFIG[pedidoSeleccionado.estado].bg}>
                  <div className={'w-2 h-2 rounded-full ' + (pedidoSeleccionado.estado === 'esperando_rider' ? 'bg-orange-400 animate-pulse' : pedidoSeleccionado.estado === 'en_camino' ? 'bg-purple-400 animate-pulse' : 'bg-green-400')} />
                  <span className={'text-sm font-bold ' + ESTADO_PEDIDO_CONFIG[pedidoSeleccionado.estado].color}>
                    {ESTADO_PEDIDO_CONFIG[pedidoSeleccionado.estado].label}
                  </span>
                </div>

                <div className="bg-purple-50 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-purple-500 mb-1">RESTAURANTE</p>
                  <p className="font-bold text-gray-900">{pedidoSeleccionado.restaurante}</p>
                  <p className="text-sm text-gray-500">{pedidoSeleccionado.restauranteDireccion}</p>
                  <a
                    href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(pedidoSeleccionado.restauranteDireccion + ', Piñas, Ecuador')}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-purple-600"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Ver en Maps
                  </a>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-gray-400 mb-1">CLIENTE</p>
                  <p className="font-bold text-gray-900">{pedidoSeleccionado.clienteNombre}</p>
                  <p className="text-sm text-gray-500">{pedidoSeleccionado.clienteDireccion}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <a
                      href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(pedidoSeleccionado.clienteDireccion + ', Piñas, Ecuador')}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Ver en Maps
                    </a>
                    <a
                      href={'tel:' + pedidoSeleccionado.clienteTelefono}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-green-600"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Llamar
                    </a>
                  </div>
                </div>

                <div className="border border-gray-100 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-gray-400 mb-2">PRODUCTOS</p>
                  {pedidoSeleccionado.items.map((item, i) => (
                    <p key={i} className="text-sm text-gray-700 py-0.5">{item}</p>
                  ))}
                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between">
                    <span className="text-sm text-gray-500">Total</span>
                    <span className="font-bold text-gray-900">${pedidoSeleccionado.total.toFixed(2)}</span>
                  </div>
                </div>

                {pedidoSeleccionado.riderId && (() => {
                  const rider = riders.find((r) => r.id === pedidoSeleccionado.riderId);
                  if (!rider) return null;
                  return (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
                      {getSafeImageSrc(rider.photoURL) ? (
                        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200 relative">
                          <Image
                            src={getSafeImageSrc(rider.photoURL)!}
                            alt={rider.nombre}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className={'w-10 h-10 rounded-xl ' + rider.color + ' flex items-center justify-center text-white font-black flex-shrink-0'}>
                          {rider.inicial}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{rider.nombre}</p>
                        <p className="text-xs text-gray-500">Rider asignado</p>
                      </div>
                      <a
                        href={'tel:' + rider.telefono}
                        className="w-9 h-9 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center"
                      >
                        <Phone className="w-4 h-4 text-green-600" />
                      </a>
                    </div>
                  );
                })()}

                <div className="space-y-2 pt-1">
                  {pedidoSeleccionado.estado === 'esperando_rider' && (
                    <button
                      type="button"
                      onClick={() => setMostrarAsignar(true)}
                      className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black flex items-center justify-center gap-2 transition-colors"
                    >
                      <Bike className="w-5 h-5" />
                      Asignar rider
                    </button>
                  )}
                  {(pedidoSeleccionado.estado === 'asignado' || pedidoSeleccionado.estado === 'en_camino') && (
                    <LoadingButton
                      type="button"
                      loading={avanzandoId === pedidoSeleccionado.id}
                      disabled={avanzandoId === pedidoSeleccionado.id}
                      onClick={() => {
                        avanzarEstado(pedidoSeleccionado.id);
                        const nuevo = pedidoSeleccionado.estado === 'asignado' ? 'en_camino' : 'entregado';
                        setPedidoSeleccionado({ ...pedidoSeleccionado, estado: nuevo });
                      }}
                      className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black flex items-center justify-center gap-2 transition-colors"
                    >
                      <RefreshCw className="w-5 h-5" />
                      {pedidoSeleccionado.estado === 'asignado' ? 'Marcar En camino' : 'Marcar Entregado'}
                    </LoadingButton>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {mostrarAsignar && pedidoSeleccionado && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60">
            <div
              className="bg-white rounded-t-3xl max-h-[70vh] overflow-y-auto"
              style={{ animation: 'slideUp 0.3s ease forwards' }}
            >
              <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-gray-900">Asignar rider</h3>
                  <p className="text-xs text-gray-400">Pedido #{pedidoSeleccionado.id} · {pedidoSeleccionado.clienteNombre}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarAsignar(false)}
                  className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="p-5 space-y-2">
                {riders.filter((r) => r.estado === 'disponible').length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-10 h-10 text-orange-300 mx-auto mb-3" />
                    <p className="font-bold text-gray-500">No hay riders disponibles</p>
                    <p className="text-xs text-gray-400 mt-1">Todos están ocupados o fuera de servicio</p>
                  </div>
                ) : (
                  riders
                    .filter((r) => r.estado === 'disponible')
                    .map((rider) => (
                      <LoadingButton
                        key={rider.id}
                        type="button"
                        loading={asignandoKey === `${pedidoSeleccionado.id}_${rider.id}`}
                        disabled={!!asignandoKey}
                        onClick={() => asignarRider(pedidoSeleccionado.id, rider.id, pedidoSeleccionado.batchId)}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                      >
                        {getSafeImageSrc(rider.photoURL) ? (
                          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200 relative">
                            <Image
                              src={getSafeImageSrc(rider.photoURL)!}
                              alt={rider.nombre}
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className={'w-11 h-11 rounded-xl ' + rider.color + ' flex items-center justify-center text-white font-black text-lg flex-shrink-0'}>
                            {rider.inicial}
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <p className="font-bold text-gray-900">{rider.nombre}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                            <p className="text-xs text-gray-500">Disponible · {rider.carrerasHoy} carreras hoy · ⭐ {rider.calificacion}</p>
                          </div>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <Check className="w-5 h-5 text-purple-600" />
                        </div>
                      </LoadingButton>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-2xl whitespace-nowrap"
            style={{ animation: 'fadeSlideIn 0.3s ease forwards' }}
          >
            {toast}
          </div>
        )}

        <style>{PANEL_CENTRAL_KEYFRAMES}</style>
      </>
    );
  }

  return <PanelCentralContent />;
}

/* ─────────────── tarjeta de pedido ─────────────── */
const TarjetaPedidoCentral = memo(function TarjetaPedidoCentral({
  pedido,
  riders,
  isNuevo,
  esMultiStop = false,
  numeroParada = null,
  totalParadas = null,
  avanzandoId = null,
  asignandoKey = null,
  onAsignar,
  onVerDetalle,
  onAvanzar,
  onEliminar,
}: {
  pedido: PedidoCentral;
  riders: RiderCentral[];
  isNuevo: boolean;
  esMultiStop?: boolean;
  numeroParada?: number | null;
  totalParadas?: number | null;
  avanzandoId?: string | null;
  asignandoKey?: string | null;
  onAsignar: () => void;
  onVerDetalle: () => void;
  onAvanzar: () => void;
  onEliminar: () => void;
}) {
  const cfg = ESTADO_PEDIDO_CONFIG[pedido.estado];
  const rider = riders.find((r) => r.id === pedido.riderId);
  const esUrgente = pedido.estado === 'esperando_rider';

  return (
    <div
      className={`bg-white rounded-3xl overflow-hidden shadow-sm border-2 transition-all ${
        isNuevo ? 'border-orange-400 shadow-orange-100 shadow-lg' : esUrgente ? 'border-orange-200' : 'border-gray-100'
      }`}
      style={{ animation: isNuevo ? 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' : undefined }}
    >
      {/* badge estado */}
      <div className={`px-4 py-2 flex items-center gap-2 text-xs font-bold ${cfg.bg} ${cfg.color} border-b border-current/10`}>
        <div className={`w-2 h-2 rounded-full ${esUrgente ? 'bg-orange-400 animate-pulse' : 'bg-current opacity-60'}`} />
        {isNuevo && <span className="bg-orange-500 text-white px-2 py-0.5 rounded-full mr-1">NUEVO</span>}
        {cfg.label}
        {esMultiStop && totalParadas && (
          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-semibold">
            <Package className="w-3 h-3" />
            Multi-stop · Parada {numeroParada ?? 1}/{totalParadas}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 opacity-60">
          <Clock className="w-3 h-3" />
          {tiempoTranscurrido(pedido.timestamp)}
        </span>
      </div>

      <div className="p-4">
        {/* ruta visual */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex flex-col items-center gap-1 mt-1 flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <div className="w-0.5 h-5 bg-gray-200" />
            <div className="w-3 h-3 rounded-full bg-rojo-andino" />
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            <div>
              <p className="text-[10px] text-gray-400 font-semibold">RESTAURANTE</p>
              <p className="font-bold text-sm text-gray-900 leading-tight truncate">{pedido.restaurante}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold">CLIENTE</p>
              <p className="font-bold text-sm text-gray-900 leading-tight">{pedido.clienteNombre}</p>
              <p className="text-xs text-gray-400 truncate">{pedido.clienteDireccion}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-black text-base text-gray-900">${pedido.total.toFixed(2)}</p>
            <p className="text-xs text-gray-400">{pedido.distancia}</p>
          </div>
        </div>

        {/* rider asignado */}
        {rider && (
          <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2 mb-3">
            {getSafeImageSrc(rider.photoURL) ? (
              <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 relative">
                <Image
                  src={getSafeImageSrc(rider.photoURL)!}
                  alt={rider.nombre}
                  fill
                  sizes="24px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className={`w-6 h-6 rounded-lg ${rider.color} flex items-center justify-center text-white font-black text-xs`}>
                {rider.inicial}
              </div>
            )}
            <p className="text-xs font-bold text-blue-700">{rider.nombre}</p>
            <span className="ml-auto text-[10px] text-blue-500">
              {pedido.estado === 'en_camino' ? '🏍 En camino' : '✓ Asignado'}
            </span>
          </div>
        )}

        {/* botones */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onVerDetalle}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-50 transition-colors"
          >
            Ver detalle
          </button>
          {esUrgente && (
            <LoadingButton
              type="button"
              loading={!!asignandoKey}
              disabled={!!asignandoKey}
              onClick={onAsignar}
              className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Bike className="w-3.5 h-3.5" />
              Asignar rider
            </LoadingButton>
          )}
          {(pedido.estado === 'asignado' || pedido.estado === 'en_camino') && (
            <LoadingButton
              type="button"
              loading={avanzandoId === pedido.id}
              disabled={avanzandoId === pedido.id}
              onClick={onAvanzar}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {pedido.estado === 'asignado' ? 'En camino' : 'Entregar'}
            </LoadingButton>
          )}
          <button
            type="button"
            onClick={onEliminar}
            className="p-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            title="Eliminar pedido (pruebas/bugeado)"
            aria-label="Eliminar pedido"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
});
