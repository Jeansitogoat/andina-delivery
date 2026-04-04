'use client';

import { use, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase/client';
import { useAuth } from '@/lib/useAuth';
import { getOrderMoney } from '@/lib/order-money';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Bike,
  PackageCheck,
  MapPin,
  Phone,
  ArrowLeft,
  Shield,
  Copy,
  Check,
  Star,
  Bell,
  XCircle,
  RefreshCw,
  MessageCircle,
  Receipt,
} from 'lucide-react';

const MOTIVOS_RAPIDOS_CANCEL_CLIENTE = [
  'Cambié de opinión',
  'Pedí por error',
  'Demora estimada muy larga',
  'Otro (escribir abajo)',
] as const;
import { useNotifications } from '@/lib/useNotifications';
import { getIdToken } from '@/lib/authToken';
import { useToast } from '@/lib/ToastContext';
import { formatWhatsAppLink } from '@/lib/utils/phone';
import SeguimientoStepper from '@/components/seguimiento/SeguimientoStepper';
import {
  labelsStepperComida,
  labelsStepperPickup,
  pasoStepper4ComidaDelivery,
  pasoStepper4ComidaPickup,
} from '@/lib/seguimiento-mapa';
import { formatEcuador } from '@/lib/dateEcuador';

/* ─────────────── tipos ─────────────── */
interface EstadoPedido {
  id: string;
  label: string;
  sublabel: string;
  icono: React.ReactNode;
  color: string;
  bgColor: string;
}

const ESTADOS: EstadoPedido[] = [
  {
    id: 'confirmado',
    label: 'Esperando confirmación',
    sublabel: 'El local debe aceptar tu pedido. Puedes cancelar mientras no lo acepten.',
    icono: <Clock className="w-5 h-5" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500',
  },
  {
    id: 'preparando',
    label: 'Preparando tu pedido',
    sublabel: 'El restaurante está cocinando',
    icono: <ChefHat className="w-5 h-5" />,
    color: 'text-dorado-oro',
    bgColor: 'bg-dorado-oro',
  },
  {
    id: 'listo',
    label: 'Pedido listo en cocina',
    sublabel: 'El local marcó tu pedido como listo. Te avisamos cuando el rider vaya en camino.',
    icono: <PackageCheck className="w-5 h-5" />,
    color: 'text-green-600',
    bgColor: 'bg-green-500',
  },
  {
    id: 'en_camino',
    label: 'Rider en camino',
    sublabel: 'Tu pedido está siendo entregado',
    icono: <Bike className="w-5 h-5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500',
  },
  {
    id: 'entregado',
    label: '¡Pedido entregado!',
    sublabel: 'Que lo disfrutes',
    icono: <PackageCheck className="w-5 h-5" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-500',
  },
  {
    id: 'cancelado_local',
    label: 'Pedido cancelado',
    sublabel: 'El negocio canceló este pedido',
    icono: <XCircle className="w-5 h-5" />,
    color: 'text-red-600',
    bgColor: 'bg-red-500',
  },
  {
    id: 'cancelado_cliente',
    label: 'Cancelado por ti',
    sublabel: 'Cancelaste este pedido',
    icono: <XCircle className="w-5 h-5" />,
    color: 'text-red-600',
    bgColor: 'bg-red-500',
  },
  {
    id: 'cancelado_central',
    label: 'Pedido cancelado',
    sublabel: 'La operación canceló este pedido',
    icono: <XCircle className="w-5 h-5" />,
    color: 'text-red-600',
    bgColor: 'bg-red-500',
  },
];

const ESTADOS_PICKUP: EstadoPedido[] = [
  { id: 'confirmado', label: 'Esperando confirmación', sublabel: 'El local debe aceptar tu pedido.', icono: <Clock className="w-5 h-5" />, color: 'text-amber-600', bgColor: 'bg-amber-500' },
  { id: 'preparando', label: 'Preparando', sublabel: 'El local está preparando tu pedido.', icono: <ChefHat className="w-5 h-5" />, color: 'text-dorado-oro', bgColor: 'bg-dorado-oro' },
  { id: 'listo', label: 'Listo para retirar', sublabel: 'Pasa a recogerlo al local.', icono: <PackageCheck className="w-5 h-5" />, color: 'text-green-600', bgColor: 'bg-green-500' },
  { id: 'entregado', label: 'Retirado', sublabel: 'Que lo disfrutes.', icono: <CheckCircle2 className="w-5 h-5" />, color: 'text-purple-600', bgColor: 'bg-purple-500' },
  { id: 'cancelado_local', label: 'Pedido cancelado', sublabel: 'El negocio canceló este pedido.', icono: <XCircle className="w-5 h-5" />, color: 'text-red-600', bgColor: 'bg-red-500' },
  { id: 'cancelado_cliente', label: 'Cancelado por ti', sublabel: 'Cancelaste este pedido.', icono: <XCircle className="w-5 h-5" />, color: 'text-red-600', bgColor: 'bg-red-500' },
  { id: 'cancelado_central', label: 'Pedido cancelado', sublabel: 'La operación canceló este pedido.', icono: <XCircle className="w-5 h-5" />, color: 'text-red-600', bgColor: 'bg-red-500' },
];

const INDICE_ESTADO: Record<string, number> = {
  confirmado: 0,
  preparando: 1,
  listo: 2,
  en_camino: 3,
  entregado: 4,
  cancelado_local: 5,
  cancelado_cliente: 6,
  cancelado_central: 7,
};

const INDICE_ESTADO_PICKUP: Record<string, number> = {
  confirmado: 0,
  preparando: 1,
  listo: 2,
  entregado: 3,
  cancelado_local: 4,
  cancelado_cliente: 5,
  cancelado_central: 6,
};

export default function SeguimientoPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const { permission, requestPermission, loading: notifLoading, isSupported } = useNotifications('user');

  /* ── estado desde API (tiempo real) ── */
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [estadoActual, setEstadoActual] = useState<string>('confirmado');
  const [copiado, setCopiado] = useState(false);
  const [mostrarRating, setMostrarRating] = useState(false);
  const [estrellas, setEstrellas] = useState(0);
  const [estrellasRider, setEstrellasRider] = useState(0);
  const [reseñaLocal, setReseñaLocal] = useState('');
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);
  const [calificacionEnviada, setCalificacionEnviada] = useState(false);
  const [tiempoRestante, setTiempoRestante] = useState(28);
  const tiempoRestanteMostrar = Math.max(0, tiempoRestante);
  const [riderNombre, setRiderNombre] = useState<string>('');
  const [riderRating, setRiderRating] = useState<number | null>(null);

  function mapApiEstadoToUI(estado: string, isPickup: boolean): string {
    if (estado === 'cancelado_central') return 'cancelado_central';
    if (estado === 'cancelado_cliente') return 'cancelado_cliente';
    if (estado === 'cancelado_local') return 'cancelado_local';
    if (estado === 'entregado') return 'entregado';
    if (isPickup) {
      if (estado === 'confirmado') return 'confirmado';
      if (estado === 'preparando') return 'preparando';
      if (estado === 'listo' || estado === 'esperando_rider' || estado === 'asignado' || estado === 'en_camino') return 'listo';
      return 'confirmado';
    }
    if (estado === 'confirmado') return 'confirmado';
    if (estado === 'preparando') return 'preparando';
    if (estado === 'listo') return 'listo';
    if (estado === 'esperando_rider' || estado === 'asignado') return 'listo';
    if (estado === 'en_camino') return 'en_camino';
    return 'confirmado';
  }

  const [codigoVerificacion, setCodigoVerificacion] = useState('----');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [paymentConfirmed, setPaymentConfirmed] = useState(true);
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [restauranteNombre, setRestauranteNombre] = useState('');
  const [restauranteDireccion, setRestauranteDireccion] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelMotivoCliente, setCancelMotivoCliente] = useState('');
  const [pedidoTotalRef, setPedidoTotalRef] = useState(0);
  const [telefonoLocalRef, setTelefonoLocalRef] = useState<string | null>(null);
  const [motivoCancelacionApi, setMotivoCancelacionApi] = useState<string | null>(null);
  const [pedidoTimestampMs, setPedidoTimestampMs] = useState<number | null>(null);
  const [transporteCoordinaCentral, setTransporteCoordinaCentral] = useState(false);
  /** Desglose para mostrar total a pagar (productos, IVA, envío, costo servicio, propina). */
  const [pagoDetalle, setPagoDetalle] = useState<{
    subtotalBase: number;
    ivaAmount: number;
    ivaEnabled: boolean;
    subtotalConIva: number;
    costoEnvio: number;
    serviceFee: number;
    propina: number;
    totalCliente: number;
  } | null>(null);

  const { showToast } = useToast();

  const [retryTrigger, setRetryTrigger] = useState(0);
  const prevUiEstadoRef = useRef<string>('');

  useEffect(() => {
    prevUiEstadoRef.current = '';
  }, [id]);

  /** Actualiza UI desde el documento Firestore `pedidos/{id}` (misma forma que la API). */
  const applyPedidoFromFirestore = useCallback(
    (data: Record<string, unknown>, options?: { showRatingToast?: boolean }) => {
      const money = getOrderMoney(data);
      const rawEstado = (data.estado as string) || 'confirmado';
      const isPickup = data.deliveryType === 'pickup';
      const uiEstado = mapApiEstadoToUI(rawEstado, isPickup);
      const transporte = data.transporte === 'buscando_rider' ? 'buscando_rider' : 'pendiente';

      setEstadoActual(uiEstado);
      setTransporteCoordinaCentral(
        !isPickup && transporte === 'buscando_rider' && (rawEstado === 'preparando' || rawEstado === 'listo')
      );
      setDeliveryType(isPickup ? 'pickup' : 'delivery');
      if (typeof data.restaurante === 'string') setRestauranteNombre(data.restaurante);
      if (typeof data.restauranteDireccion === 'string') setRestauranteDireccion(data.restauranteDireccion);
      if (typeof data.riderNombre === 'string') setRiderNombre(data.riderNombre);
      if (Object.prototype.hasOwnProperty.call(data, 'riderRatingSnapshot')) {
        const rs = data.riderRatingSnapshot;
        setRiderRating(rs == null || rs === '' ? null : Number(rs));
      }
      if (typeof data.codigoVerificacion === 'string') setCodigoVerificacion(data.codigoVerificacion);
      if (data.paymentMethod === 'transferencia' || data.paymentMethod === 'efectivo') {
        setPaymentMethod(data.paymentMethod);
      }
      setPaymentConfirmed(data.paymentConfirmed !== false);
      setPedidoTotalRef(money.totalCliente);
      setPagoDetalle({
        subtotalBase: money.subtotalBase,
        ivaAmount: money.ivaAmount,
        ivaEnabled: money.ivaEnabled,
        subtotalConIva: money.subtotalConIva,
        costoEnvio: money.costoEnvio,
        serviceFee: money.serviceFee,
        propina: money.propina,
        totalCliente: money.totalCliente,
      });
      setTelefonoLocalRef(
        typeof data.telefonoLocal === 'string' && data.telefonoLocal.trim()
          ? data.telefonoLocal.trim()
          : null
      );
      setMotivoCancelacionApi(
        typeof data.motivoCancelacion === 'string' && data.motivoCancelacion.trim()
          ? data.motivoCancelacion.trim()
          : null
      );
      let tsMs: number | null = null;
      const rawTs = data.timestamp;
      if (typeof rawTs === 'number' && !Number.isNaN(rawTs)) {
        tsMs = rawTs;
      } else if (
        rawTs &&
        typeof rawTs === 'object' &&
        'toMillis' in rawTs &&
        typeof (rawTs as { toMillis: () => number }).toMillis === 'function'
      ) {
        tsMs = (rawTs as { toMillis: () => number }).toMillis();
      }
      if (tsMs != null) setPedidoTimestampMs(tsMs);

      if (uiEstado === 'en_camino') setTiempoRestante((t) => Math.max(0, t > 15 ? 15 : t));
      const showRating =
        options?.showRatingToast ??
        (uiEstado === 'entregado' && prevUiEstadoRef.current !== 'entregado');
      if (uiEstado === 'entregado') {
        setTiempoRestante(0);
        if (showRating) {
          setTimeout(() => setMostrarRating(true), 1200);
        }
      }
      prevUiEstadoRef.current = uiEstado;
    },
    []
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth?redirect=/pedido/${encodeURIComponent(id)}`);
      return;
    }

    setLoading(true);
    setFetchError(null);
    const db = getFirestoreDb();
    const ref = doc(db, 'pedidos', id);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setLoading(false);
          setFetchError('No encontramos este pedido. Revisa el número e intenta de nuevo.');
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        if (user.rol === 'cliente' && data.clienteId !== user.uid) {
          setLoading(false);
          setFetchError('No tienes acceso a este pedido.');
          return;
        }
        applyPedidoFromFirestore(data);
        setLoading(false);
        setFetchError(null);
      },
      (err) => {
        console.error('[pedido] onSnapshot', err);
        setLoading(false);
        setFetchError('No pudimos cargar el pedido. Revisa tu conexión e intenta de nuevo.');
      }
    );

    return () => unsub();
  }, [authLoading, user, id, router, retryTrigger, applyPedidoFromFirestore]);

  /* cuenta regresiva cuando está en camino */
  useEffect(() => {
    if (estadoActual !== 'en_camino' || tiempoRestante <= 0) return;
    const t = setInterval(() => setTiempoRestante((v) => Math.max(0, v - 1)), 60000);
    return () => clearInterval(t);
  }, [estadoActual, tiempoRestante]);

  const isPickup = deliveryType === 'pickup';
  const estadosParaMostrar = isPickup ? ESTADOS_PICKUP : ESTADOS;
  const indiceParaMostrar = isPickup ? INDICE_ESTADO_PICKUP : INDICE_ESTADO;
  const idxActual = indiceParaMostrar[estadoActual] ?? 0;
  const estadoCancelado =
    estadoActual === 'cancelado_local' ||
    estadoActual === 'cancelado_cliente' ||
    estadoActual === 'cancelado_central';
  const mostrarAlertaMotivoOperacion =
    estadoActual === 'cancelado_local' || estadoActual === 'cancelado_central';

  /* copiar código */
  function copiarCodigo() {
    navigator.clipboard.writeText(codigoVerificacion).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ── encabezado ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 h-14">
          <button
            type="button"
            onClick={() => router.push('/?modo=cliente')}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight">Seguimiento del pedido</p>
            <p className="text-xs text-gray-400 font-mono truncate">#{id}</p>
          </div>
          {tiempoRestanteMostrar > 0 && estadoActual !== 'entregado' && !estadoCancelado && !(paymentMethod === 'transferencia' && !paymentConfirmed) && (
            <div className="flex items-center gap-1.5 bg-rojo-andino/10 text-rojo-andino px-3 py-1.5 rounded-xl">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold">{tiempoRestanteMostrar} min</span>
            </div>
          )}
        </div>
      </header>

      {/* Loading state */}
      {loading && (
        <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
          <p className="text-gray-500 text-sm">Cargando seguimiento del pedido…</p>
        </div>
      )}

      {/* Error state */}
      {fetchError && !loading && (
        <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="font-bold text-lg text-gray-900 mb-2">No se pudo cargar</h2>
          <p className="text-gray-600 text-sm text-center mb-6">{fetchError}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRetryTrigger((v) => v + 1)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-rojo-andino text-white font-semibold hover:bg-rojo-andino/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => router.push('/?modo=cliente')}
              className="px-5 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      )}

      {!loading && !fetchError && (
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {permission === 'default' && estadoActual !== 'entregado' && !estadoCancelado && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-dorado-oro/10 border border-dorado-oro/20">
            <p className="text-xs text-gray-700 flex items-center gap-2">
              <Bell className="w-4 h-4 text-dorado-oro flex-shrink-0" />
              Activa notificaciones para saber cuando va en camino
            </p>
            <button
              type="button"
              onClick={requestPermission}
              disabled={notifLoading}
              className="flex-shrink-0 text-xs font-bold text-dorado-oro hover:underline disabled:opacity-70"
            >
              {notifLoading ? '...' : 'Activar'}
            </button>
          </div>
        )}

        {pagoDetalle && (pagoDetalle.totalCliente > 0 || pagoDetalle.subtotalBase > 0) && !estadoCancelado && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="w-5 h-5 text-rojo-andino flex-shrink-0" />
              <h3 className="font-bold text-gray-900 text-sm">Total a pagar</h3>
            </div>
            {pedidoTimestampMs != null ? (
              <p className="text-xs text-gray-500 mb-3 leading-snug">
                Pedido realizado:{' '}
                <span className="font-medium text-gray-700">{formatEcuador(pedidoTimestampMs)}</span>
                <span className="text-gray-400"> · Hora Ecuador (Piñas)</span>
              </p>
            ) : null}
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-600">Productos (menú)</dt>
                <dd className="font-medium text-gray-900 tabular-nums">${pagoDetalle.subtotalBase.toFixed(2)}</dd>
              </div>
              {pagoDetalle.ivaEnabled && pagoDetalle.ivaAmount > 0 ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600">IVA</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">${pagoDetalle.ivaAmount.toFixed(2)}</dd>
                </div>
              ) : null}
              {pagoDetalle.ivaEnabled && pagoDetalle.subtotalConIva > pagoDetalle.subtotalBase + 0.001 ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600">Subtotal con IVA</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">${pagoDetalle.subtotalConIva.toFixed(2)}</dd>
                </div>
              ) : null}
              {deliveryType !== 'pickup' && pagoDetalle.costoEnvio > 0 ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600">Envío</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">${pagoDetalle.costoEnvio.toFixed(2)}</dd>
                </div>
              ) : null}
              {pagoDetalle.serviceFee > 0 ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600">Costo de servicio Andina</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">${pagoDetalle.serviceFee.toFixed(2)}</dd>
                </div>
              ) : null}
              {pagoDetalle.propina > 0 ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600">Propina</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">${pagoDetalle.propina.toFixed(2)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2 pt-2 border-t border-gray-100">
                <dt className="font-bold text-gray-900">Total</dt>
                <dd className="font-black text-rojo-andino text-lg tabular-nums">${pagoDetalle.totalCliente.toFixed(2)}</dd>
              </div>
            </dl>
          </div>
        )}

        {/* ── Pendiente confirmación de pago (transferencia) ── */}
        {paymentMethod === 'transferencia' && !paymentConfirmed && !estadoCancelado && (
          <div
            className="rounded-3xl p-6 text-center shadow-lg border-2 border-dorado-oro/30 bg-gradient-to-br from-amber-50 to-yellow-50"
            style={{ animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
          >
            <div className="w-16 h-16 rounded-full bg-dorado-oro/20 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-dorado-oro" />
            </div>
            <h2 className="font-black text-xl text-gray-900 mb-2">Esperando confirmación de pago</h2>
            <p className="text-sm text-gray-600 mb-4">
              Cuando el restaurante confirme tu comprobante, tu pedido pasará a preparación y verás aquí el progreso en tiempo real.
            </p>
            <p className="text-xs text-gray-500">Pedido {id}</p>
          </div>
        )}

        {/* ── estado actual grande ── */}
        {(paymentMethod !== 'transferencia' || paymentConfirmed || estadoCancelado) && (
        <>
        <div
          className="rounded-3xl p-6 text-white text-center shadow-lg"
          style={{
            background:
              estadoCancelado
                ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                : estadoActual === 'entregado'
                ? 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'
                : estadoActual === 'en_camino'
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                : estadoActual === 'listo'
                ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                : estadoActual === 'preparando'
                ? 'linear-gradient(135deg, #c9960d 0%, #a67a08 100%)'
                : 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
            animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
          }}
        >
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            {estadosParaMostrar[idxActual]?.icono && (
              <span className="text-white scale-150">
                {estadosParaMostrar[idxActual].icono}
              </span>
            )}
          </div>
          <h2 className="font-black text-xl mb-1">{estadosParaMostrar[idxActual]?.label ?? '—'}</h2>
          <p className="text-white/80 text-sm">{estadosParaMostrar[idxActual]?.sublabel ?? ''}</p>

          {tiempoRestanteMostrar > 0 && estadoActual !== 'entregado' && !estadoCancelado && (
            <div className="mt-4 bg-white/20 rounded-2xl px-5 py-2.5 inline-flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="font-bold text-sm">~{tiempoRestanteMostrar} min restantes</span>
            </div>
          )}

          {estadoActual === 'confirmado' && (
            <button
              type="button"
              onClick={() => {
                setCancelMotivoCliente('');
                setShowCancelModal(true);
              }}
              disabled={cancelando}
              className="mt-4 px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {cancelando ? 'Cancelando...' : 'Cancelar pedido'}
            </button>
          )}
        </div>

        {mostrarAlertaMotivoOperacion ? (
          <div
            className="rounded-2xl border border-red-200/70 bg-red-50/90 px-4 py-3 text-sm text-red-950 shadow-sm"
            role="status"
          >
            <p className="font-medium leading-snug">
              Orden cancelada:{' '}
              {motivoCancelacionApi?.trim()
                ? motivoCancelacionApi.trim()
                : 'Contacta a soporte para más información.'}
            </p>
          </div>
        ) : null}

        {transporteCoordinaCentral && !estadoCancelado && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/90 px-4 py-3 text-left">
            <p className="text-xs font-semibold text-blue-900">Coordinando reparto</p>
            <p className="text-xs text-blue-800/90 mt-1 leading-snug">
              El local ya avisó a central para buscar rider. Eso no sustituye el paso &quot;listo en cocina&quot;: puedes seguir viendo el estado real de preparación arriba.
            </p>
          </div>
        )}

        {/* ── barra de progreso (4 pasos) ── */}
        {!estadoCancelado && (
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 text-sm mb-4">Progreso del pedido</h3>
            <SeguimientoStepper
              labels={isPickup ? labelsStepperPickup() : labelsStepperComida()}
              pasoActual={
                isPickup
                  ? pasoStepper4ComidaPickup(estadoActual)
                  : pasoStepper4ComidaDelivery(estadoActual)
              }
            />
          </div>
        )}

        {estadoCancelado && paymentMethod === 'transferencia' && (
          <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-emerald-200 ring-1 ring-emerald-100">
            <h3 className="font-black text-gray-900 text-sm mb-1">Reembolso</h3>
            <p className="text-xs text-gray-600 mb-4">
              Pagaste por transferencia y el pedido fue cancelado. Puedes solicitar tu devolución por WhatsApp al local.
            </p>
            {formatWhatsAppLink(telefonoLocalRef) ? (
              <a
                href={`${formatWhatsAppLink(telefonoLocalRef)}?text=${encodeURIComponent(
                  `Hola, mi pedido #${id} fue cancelado y solicito mi reembolso de $${pedidoTotalRef.toFixed(2)}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black text-sm shadow-lg transition-colors"
              >
                <MessageCircle className="w-5 h-5 flex-shrink-0" />
                Solicitar Reembolso por WhatsApp
              </a>
            ) : (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                No encontramos el WhatsApp del local en este pedido. Escríbenos a soporte Andina o al restaurante por el canal que usaste al pedir.
              </p>
            )}
          </div>
        )}

        {/* ── Retiro en local: dirección del negocio ── */}
        {isPickup && (restauranteNombre || restauranteDireccion) && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium">Retiro en</p>
                <p className="text-sm font-bold text-gray-900">{restauranteNombre || 'Local'}</p>
                {restauranteDireccion && (
                  <p className="text-xs text-gray-600 mt-0.5 truncate">{restauranteDireccion}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">Cuando esté listo, pasa a recoger tu pedido al local.</p>
          </div>
        )}

        {/* ── mapa placeholder (solo delivery) ── */}
        {!isPickup && (
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
          <div className="relative bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 h-44 flex items-center justify-center border-b border-gray-100">
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'linear-gradient(#9ca3af 1px, transparent 1px), linear-gradient(90deg, #9ca3af 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 bg-white/60 rounded" />
            <div className="absolute top-0 bottom-0 left-1/3 -translate-x-1/2 w-2 bg-white/60 rounded" />
            <div className="absolute top-0 bottom-0 left-2/3 -translate-x-1/2 w-1 bg-white/40 rounded" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-rojo-andino shadow-lg flex items-center justify-center mb-1">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white text-xs font-bold text-gray-800 px-2 py-1 rounded-xl shadow">
                Tu dirección
              </div>
            </div>
            {(estadoActual === 'en_camino' || estadoActual === 'entregado') && (
              <div
                className="absolute left-1/3 top-1/2 -translate-x-8 -translate-y-12 transition-all duration-[3000ms]"
                style={{ animation: 'riderMove 4s ease-in-out infinite alternate' }}
              >
                <div className="w-9 h-9 rounded-full bg-blue-500 shadow-lg flex items-center justify-center">
                  <Bike className="w-5 h-5 text-white" />
                </div>
              </div>
            )}
            <div className="absolute bottom-2 right-3 text-[10px] text-gray-400 font-medium">
              Mapa referencial · Piñas, El Oro
            </div>
          </div>
          <div className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-rojo-andino" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 font-medium">Entregando en</p>
              <p className="text-sm font-bold text-gray-900 truncate">Dirección de entrega</p>
            </div>
          </div>
        </div>
        )}

        {/* ── código de verificación (solo delivery) ── */}
        {!isPickup && (
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-dorado-oro" />
            <h3 className="font-bold text-gray-900 text-sm">Código de verificación</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Muestra este código al rider cuando recibas tu pedido. Él debe ingresarlo para confirmar la entrega.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-900 rounded-2xl py-4 px-5 text-center">
              <span className="font-black text-3xl text-white font-mono tracking-[0.3em]">
                {codigoVerificacion}
              </span>
            </div>
            <button
              type="button"
              onClick={copiarCodigo}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${
                copiado
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              {copiado ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>
        )}

        {/* ── info del rider (solo delivery) ── */}
        {!isPickup && (estadoActual === 'en_camino' || estadoActual === 'entregado') && (
          <div
            className="bg-white rounded-3xl p-5 shadow-sm"
            style={{ animation: 'fadeSlideIn 0.4s ease forwards' }}
          >
            <h3 className="font-bold text-gray-900 text-sm mb-3">Tu rider</h3>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md">
                {(riderNombre || 'R').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{riderNombre || 'Rider'}</p>
                <p className="text-xs text-gray-500">Cía. Virgen de la Merced</p>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${s <= (riderRating ?? 0) ? 'fill-dorado-oro text-dorado-oro' : 'text-gray-200'}`}
                    />
                  ))}
                  <span className="text-xs text-gray-400 ml-1">{riderRating != null && riderRating > 0 ? riderRating.toFixed(1) : '—'}</span>
                </div>
              </div>
              <a
                href="tel:+593999999999"
                className="w-11 h-11 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center hover:bg-green-100 transition-colors"
              >
                <Phone className="w-5 h-5 text-green-600" />
              </a>
            </div>
          </div>
        )}

        {/* ── calificación post-entrega ── */}
        {mostrarRating && (
          <div
            className="bg-white rounded-3xl p-6 shadow-sm text-center"
            style={{ animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
          >
            <div className="text-3xl mb-3">🎉</div>
            <h3 className="font-black text-lg text-gray-900 mb-1">¡Llegó tu pedido!</h3>
            <p className="text-sm text-gray-500 mb-4">¿Cómo fue tu experiencia?</p>

            <div className="text-left mb-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Califica al restaurante</p>
              <div className="flex gap-2 mb-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEstrellas(s)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        s <= estrellas ? 'fill-dorado-oro text-dorado-oro' : 'text-gray-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reseña (opcional)</label>
              <textarea
                placeholder="¿Cómo fue tu experiencia?"
                value={reseñaLocal}
                onChange={(e) => setReseñaLocal(e.target.value.slice(0, 500))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none"
                rows={2}
                maxLength={500}
              />
            </div>

            {!isPickup && (
            <div className="text-left mb-5">
              <p className="text-xs font-semibold text-gray-600 mb-2">Califica al rider</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEstrellasRider(s)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        s <= estrellasRider ? 'fill-dorado-oro text-dorado-oro' : 'text-gray-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            )}

            <button
              type="button"
              disabled={enviandoCalificacion}
              onClick={async () => {
                if (calificacionEnviada) {
                  router.push('/?modo=cliente');
                  return;
                }
                setEnviandoCalificacion(true);
                try {
                  const token = await getIdToken();
                  const res = await fetch(`/api/pedidos/${id}/calificar`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                      estrellasLocal: estrellas,
                      ...(isPickup ? {} : { estrellasRider: estrellasRider }),
                      reseñaLocal: reseñaLocal || undefined,
                    }),
                  });
                  if (res.ok) {
                    setCalificacionEnviada(true);
                    router.push('/?modo=cliente');
                  }
                } finally {
                  setEnviandoCalificacion(false);
                }
              }}
              className="w-full py-3.5 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold text-sm transition-colors disabled:opacity-70"
            >
              {enviandoCalificacion ? 'Enviando...' : calificacionEnviada ? 'Ir al inicio' : 'Enviar calificación e ir al inicio'}
            </button>
            {!calificacionEnviada && (
              <button
                type="button"
                onClick={() => router.push('/?modo=cliente')}
                className="w-full mt-2 py-2.5 rounded-2xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50"
              >
                Ir al inicio sin calificar
              </button>
            )}
          </div>
        )}

        {/* ── botón volver ── */}
        {(estadoActual !== 'entregado' || estadoCancelado) && (
          <button
            type="button"
            onClick={() => router.push('/?modo=cliente')}
            className="w-full py-3.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-colors"
          >
            Volver al inicio
          </button>
        )}

        </>
        )}

      </div>
      )}

      {/* Modal confirmar cancelación por cliente */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !cancelando && setShowCancelModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-gray-900 mb-2">¿Cancelar pedido?</h3>
            <p className="text-sm text-gray-600 mb-3">El local aún no ha aceptado tu pedido. Si cancelas, no se preparará.</p>
            <p className="text-xs font-semibold text-gray-500 mb-2">Motivo de cancelación (obligatorio)</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {MOTIVOS_RAPIDOS_CANCEL_CLIENTE.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCancelMotivoCliente(m === 'Otro (escribir abajo)' ? '' : m)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    cancelMotivoCliente === m
                      ? 'bg-rojo-andino text-white border-rojo-andino'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-rojo-andino/40'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <textarea
              value={cancelMotivoCliente}
              onChange={(e) => setCancelMotivoCliente(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Escribe el motivo…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelando}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 disabled:opacity-60"
              >
                No, mantener
              </button>
              <button
                type="button"
                onClick={async () => {
                  const motivoOk = cancelMotivoCliente.trim();
                  if (!motivoOk) {
                    showToast({ type: 'error', message: 'Indica el motivo de cancelación.' });
                    return;
                  }
                  setCancelando(true);
                  try {
                    const token = await getIdToken();
                    const res = await fetch(`/api/pedidos/${id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      body: JSON.stringify({ accion: 'cancelar', motivo: motivoOk }),
                    });
                    if (res.ok) {
                      setShowCancelModal(false);
                      setCancelMotivoCliente('');
                      showToast({ type: 'success', message: 'Pedido cancelado' });
                    } else {
                      const d = await res.json().catch(() => ({}));
                      showToast({ type: 'error', message: (d as { error?: string })?.error || 'No se pudo cancelar' });
                    }
                  } catch {
                    showToast({ type: 'error', message: 'Error de conexión' });
                  } finally {
                    setCancelando(false);
                  }
                }}
                disabled={cancelando || !cancelMotivoCliente.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-60"
              >
                {cancelando ? '...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes riderMove {
          from { transform: translate(-32px, -48px); }
          to   { transform: translate(20px, -20px); }
        }
      `}</style>
    </main>
  );
}
