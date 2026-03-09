'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Truck,
  CreditCard,
  Banknote,
  ChevronRight,
  CheckCircle2,
  Upload,
  MessageCircle,
  Copy,
  FileText,
  Clock,
  Store,
  Package,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { useCart } from '@/lib/useCart';
import { useAuth } from '@/lib/useAuth';
import { useAddresses } from '@/lib/addressesContext';
import { useTarifasEnvio } from '@/lib/useTarifasEnvio';
import { haversineKm, formatDistanceKm } from '@/lib/geo';
import { getIdToken } from '@/lib/authToken';
import { mapErrorToUserMessage } from '@/lib/errorMessages';
import type { Local } from '@/lib/data';
import AddressSelector from '@/components/AddressSelector';
import AgregarDireccionModal from '@/components/usuario/AgregarDireccionModal';
import LocalLogo from '@/components/LocalLogo';
import { formatDireccionCorta } from '@/lib/formatDireccion';
import { getSafeImageSrc } from '@/lib/validImageUrl';
import {
  generateVerificationCode,
  savePedido,
  cancelTransferOrder,
} from '@/lib/orderStorage';
import { useToast } from '@/lib/ToastContext';
import { LoadingButton } from '@/components/LoadingButton';

const TIP_OPTIONS = [
  { label: 'Ahora no', value: 0 },
  { label: '$0.50', value: 0.5 },
  { label: '$1.00', value: 1.0 },
  { label: '$1.50', value: 1.5 },
  { label: '$2.00', value: 2.0 },
];

/** Coste de servicio: 2% del subtotal, mínimo $0.10 (pago del cliente). */
function getServiceCost(subtotal: number): number {
  return Math.max(0.10, Math.round(subtotal * 0.02 * 100) / 100);
}


function ComprobantePreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  return (
    <div className="w-12 h-12 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Vista previa" className="w-full h-full object-cover" />
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { cart, hydrated, clearCart } = useCart();
  const cartStops = cart.stops;
  const { direccionEntregar, direcciones, selectedId, addDireccion, direccionEntregarLatLng, userLocationLatLng } = useAddresses();
  const { getTarifaEnvioPorDistancia, porParadaAdicional, tarifaMinima } = useTarifasEnvio();
  const [pageVisible, setPageVisible] = useState(false);
  const [showAgregarDireccion, setShowAgregarDireccion] = useState(false);
  const [payment, setPayment] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [tip, setTip] = useState(1.0);
  const [confirmed, setConfirmed] = useState(false);
  const [orderNum, setOrderNum] = useState('');
  /** Tras confirmar: 'gracias' = pantalla breve efectivo, 'comprobante' = pantalla transferencia, null = formulario */
  const [postStep, setPostStep] = useState<'gracias' | 'comprobante' | null>(null);
  const [orderIdRedirect, setOrderIdRedirect] = useState('');
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobanteEnviado, setComprobanteEnviado] = useState(false);
  const [copiadoCuenta, setCopiadoCuenta] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [showModalUbicacion, setShowModalUbicacion] = useState(false);
  const [envioTarifaPrev, setEnvioTarifaPrev] = useState<number | null>(null);
  const [tarifaAjustada, setTarifaAjustada] = useState(false);
  /** Datos de transferencia al entrar a comprobante (persistidos para no depender del carrito tras clearCart) */
  const [transferenciaComprobante, setTransferenciaComprobante] = useState<Local['transferencia'] | null>(null);
  const { showToast } = useToast();

  /** Datos por parada: local + menú + ítems enriquecidos y totales */
  type StopData = {
    localId: string;
    local: Local | null;
    menu: Array<{ id: string; name: string; price: number }>;
    enrichedItems: Array<{ id: string; name: string; price: number; qty: number }>;
    subtotal: number;
    shipping: number;
    totalPerStop: number;
  };
  const [stopsData, setStopsData] = useState<StopData[]>([]);

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  useEffect(() => {
    if (cartStops.length === 0) {
      setStopsData([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      cartStops.map(async (stop) => {
        const res = await fetch(`/api/locales/${stop.localId}`).then((r) => (r.ok ? r.json() : null));
        const data = res as { local: Local; menu?: Array<{ id: string; name: string; price: number }> } | null;
        const local = data?.local ?? null;
        const menu = data?.menu ?? [];
        const enrichedItems = stop.items
          .map((c) => {
            const item = menu.find((i) => i.id === c.id);
            if (!item) return null;
            return { ...item, qty: c.qty };
          })
          .filter(Boolean) as Array<{ id: string; name: string; price: number; qty: number }>;
        const subtotal = enrichedItems.reduce((s, i) => s + i.price * i.qty, 0);
        const shipping = local?.shipping ?? 0;
        const totalPerStop = subtotal + shipping;
        return { localId: stop.localId, local, menu, enrichedItems, subtotal, shipping, totalPerStop };
      })
    ).then((data) => {
      if (!cancelled) setStopsData(data);
    }).catch(() => {
      if (!cancelled) setStopsData([]);
    });
    return () => { cancelled = true; };
  }, [cartStops]);

  const firstStopData = stopsData[0];
  const local = firstStopData?.local ?? null;
  const numParadas = stopsData.length;
  const isPickup = deliveryType === 'pickup';
  const originLatLng = direccionEntregarLatLng ?? userLocationLatLng;
  const destLatLng = local && typeof local.lat === 'number' && typeof local.lng === 'number'
    ? { lat: local.lat, lng: local.lng }
    : null;
  const km = !isPickup && originLatLng && destLatLng
    ? haversineKm(originLatLng.lat, originLatLng.lng, destLatLng.lat, destLatLng.lng)
    : null;
  const baseEnvio = km != null ? getTarifaEnvioPorDistancia(km) : tarifaMinima;
  const envioTarifa = isPickup ? 0 : (numParadas <= 1 ? baseEnvio : baseEnvio + (numParadas - 1) * porParadaAdicional);
  const subtotal = stopsData.reduce((s, d) => s + d.subtotal, 0);
  const propinaEfectiva = isPickup ? 0 : tip;
  const serviceCost = getServiceCost(subtotal);
  const grandTotal = subtotal + envioTarifa + serviceCost + propinaEfectiva;
  const allLoaded = cartStops.length > 0 && stopsData.length === cartStops.length && stopsData.every((d) => d.local != null && d.enrichedItems.length > 0);
  const totalCount = stopsData.reduce((s, d) => s + d.enrichedItems.reduce((a, i) => a + i.qty, 0), 0);
  const enrichedItems = firstStopData?.enrichedItems ?? [];
  const shipping = envioTarifa;

  useEffect(() => {
    if (hydrated && cart.stops.length === 0 && !confirmed) {
      setStopsData([]);
    }
  }, [hydrated, cart.stops.length, confirmed]);

  const necesitaDireccion = !isPickup && !direccionEntregar;
  const puedePedir = allLoaded && user && !authLoading && !isOrdering;

  /* Detectar "Tarifa ajustada por distancia" al cambiar dirección */
  useEffect(() => {
    if (!isPickup && envioTarifa > 0) {
      if (envioTarifaPrev != null && Math.abs(envioTarifa - envioTarifaPrev) > 0.001) {
        setTarifaAjustada(true);
      }
      setEnvioTarifaPrev(envioTarifa);
    } else if (isPickup) {
      setEnvioTarifaPrev(null);
      setTarifaAjustada(false);
    }
  }, [envioTarifa, envioTarifaPrev, isPickup]);

  const handleOrder = async () => {
    if (!allLoaded || stopsData.length === 0) return;
    if (isOrdering || confirmed) return;
    setAuthError(null);
    if (necesitaDireccion) {
      setShowModalUbicacion(true);
      return;
    }
    if (!user) {
      setAuthError('Debes iniciar sesión para realizar el pedido.');
      return;
    }
    const token = await getIdToken();
    if (!token) {
      setAuthError('Debes iniciar sesión para realizar el pedido.');
      return;
    }
    setIsOrdering(true);

    try {
    const dirSeleccionada = selectedId ? direcciones.find((d) => d.id === selectedId) : direcciones.find((d) => d.principal) ?? direcciones[0];
    const clienteNombre = user?.displayName ?? user?.email ?? (dirSeleccionada?.nombre ?? 'Cliente');
    const clienteTelefono = user?.telefono ?? user?.email ?? '';
    const direccion = isPickup
      ? (local?.address ? `Retiro en local: ${local.address}` : 'Retiro en local')
      : direccionEntregar; // ya validado antes: no permite pedir sin dirección
    const baseNum = Date.now().toString().slice(-6);
    const batchIdBase = !isPickup && stopsData.length > 1 ? `A-${baseNum}` : null;
    const batchLeaderLocalId = !isPickup && stopsData.length > 1 ? stopsData[0].localId : null;
    let firstOrderId = '';
    let firstOrderNum = '';
    let firstTotal = 0;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const fetchPromises: Promise<Response>[] = [];

    stopsData.forEach((stop, index) => {
      const orderId = `A-${baseNum}-${index}`;
      const num = `#${orderId}`;
      const codigo = generateVerificationCode();
      const stopTotal = index === 0
        ? stop.subtotal + envioTarifa + serviceCost + propinaEfectiva
        : stop.subtotal;
      if (index === 0) {
        firstOrderId = orderId;
        firstOrderNum = num;
        firstTotal = stopTotal;
      }
      // Datos ya van a Firestore vía POST; savePedido solo como fallback para pedido page antes de primera carga
      savePedido(orderId, {
        codigo,
        paymentMethod: payment,
        paymentConfirmed: payment === 'efectivo',
        orderNum: num,
        direccionEntregar: direccion,
        localName: stop.local?.name,
        localTime: stop.local?.time,
        grandTotal: stopTotal,
        items: stop.enrichedItems,
      });
      const res = fetch('/api/pedidos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: orderId,
          restaurante: stop.local?.name ?? '—',
          restauranteDireccion: stop.local?.address ?? '—',
          clienteNombre,
          clienteDireccion: direccion,
          clienteTelefono: clienteTelefono || '',
          items: stop.enrichedItems.map((i) => `${i.qty}× ${i.name}`),
          total: stopTotal,
          subtotal: stop.subtotal,
          ...(index === 0 ? { serviceCost } : {}),
          localId: stop.localId,
          codigoVerificacion: codigo,
          deliveryType: isPickup ? 'pickup' : 'delivery',
          paymentMethod: payment,
          paymentConfirmed: payment === 'efectivo',
          ...(batchIdBase && batchLeaderLocalId != null
            ? { batchId: batchIdBase, batchIndex: index, batchLeaderLocalId }
            : {}),
          itemsCart: (() => {
            const cartStop = cart.stops.find((s) => s.localId === stop.localId);
            if (!cartStop?.items?.length) return undefined;
            return {
              localId: stop.localId,
              items: cartStop.items.map((i) => ({ id: i.id, qty: i.qty, ...(i.note ? { note: i.note } : {}) })),
            };
          })(),
        }),
      });
      fetchPromises.push(res);

      // Pendientes de transferencia están en Firestore (panel restaurante los obtiene vía API)
    });

    const results = await Promise.all(fetchPromises);
    const any401 = results.some((r) => r.status === 401);
    if (any401) {
      setIsOrdering(false);
      setAuthError('Sesión expirada o no autorizada. Inicia sesión e intenta de nuevo.');
      return;
    }
    const any403 = results.some((r) => r.status === 403);
    if (any403) {
      setIsOrdering(false);
      setAuthError('Solo las cuentas de cliente pueden realizar pedidos. Inicia sesión con tu cuenta de cliente.');
      return;
    }
    const anyFailed = results.some((r) => !r.ok);
    if (anyFailed) {
      setIsOrdering(false);
      setAuthError('Error al crear el pedido. Intenta de nuevo.');
      showToast({ type: 'error', message: 'Parece que el internet se fue a dar una vuelta. Reintenta en un momento.' });
      return;
    }

    setIsOrdering(false);
    setOrderNum(firstOrderNum);
    setConfirmed(true);
    if (payment === 'efectivo') clearCart();
    if (payment === 'transferencia') {
      setTransferenciaComprobante(local?.transferencia ?? null);
      setPostStep('comprobante');
    } else {
      setPostStep('gracias');
    }
    setOrderIdRedirect(firstOrderId);
    setConfirmedTotal(firstTotal);
    } catch (err) {
      setIsOrdering(false);
      const { message } = mapErrorToUserMessage(err);
      setAuthError(message);
      showToast({ type: 'error', message: 'Parece que el internet se fue a dar una vuelta. Reintenta en un momento.' });
    }
  };

  useEffect(() => {
    if (postStep !== 'gracias' || !orderIdRedirect) return;
    const t = setTimeout(() => {
      router.replace(`/pedido/${orderIdRedirect}`);
    }, 2200);
    return () => clearTimeout(t);
  }, [postStep, orderIdRedirect, router]);

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
      </main>
    );
  }

  // === Pantalla gracias (efectivo) → redirect en 2s
  if (confirmed && postStep === 'gracias') {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div
          className="w-full max-w-md text-center"
          style={{ animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
        >
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="font-black text-2xl text-gray-900 mb-2">¡Gracias por tu pedido!</h1>
          <p className="text-gray-600">En unos segundos verás su estado en tiempo real.</p>
          <p className="text-sm text-gray-400 mt-4 font-mono">{orderNum}</p>
        </div>
      </main>
    );
  }

  // === Pantalla enviar comprobante (transferencia)
  if (confirmed && postStep === 'comprobante') {
    const transferencia = transferenciaComprobante ?? local?.transferencia;
    const tieneDatosTransferencia = transferencia && (transferencia.numeroCuenta || transferencia.cooperativa);

    const whatsappMsg = encodeURIComponent(
      `Hola, mi pedido es ${orderNum}. Adjunto comprobante de transferencia por $${confirmedTotal.toFixed(2)}.`
    );

    const copiarCuenta = () => {
      const numero = transferencia?.numeroCuenta ?? '';
      if (numero) navigator.clipboard.writeText(numero).catch(() => {});
      setCopiadoCuenta(true);
      setTimeout(() => setCopiadoCuenta(false), 2000);
    };

    const handleEnviarComprobante = async () => {
      if (!comprobanteFile) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = typeof reader.result === 'string' ? reader.result : '';
        if (base64) {
          const token = await getIdToken();
          await fetch(`/api/pedidos/${orderIdRedirect}/comprobante`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              comprobanteBase64: base64,
              fileName: comprobanteFile.name,
              mimeType: comprobanteFile.type,
            }),
          });
        }
        setComprobanteEnviado(true);
        clearCart();
        setTimeout(() => router.replace(`/pedido/${orderIdRedirect}`), 2200);
      };
      reader.readAsDataURL(comprobanteFile);
    };

    const handleRegresar = () => {
      cancelTransferOrder(orderIdRedirect);
      setPostStep(null);
      setConfirmed(false);
      setComprobanteFile(null);
    };

    const isImage = comprobanteFile?.type.startsWith('image/');

    if (!tieneDatosTransferencia) {
      return (
        <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-md text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h1 className="font-bold text-xl text-gray-900 mb-2">Pago por transferencia no disponible</h1>
            <p className="text-gray-600 text-sm">
              Este negocio no tiene datos de transferencia configurados. Elige otro método de pago o contacta al negocio.
            </p>
            <button
              type="button"
              onClick={() => {
                cancelTransferOrder(orderIdRedirect);
                setPostStep(null);
                setConfirmed(false);
              }}
              className="mt-6 w-full py-3 rounded-xl bg-rojo-andino text-white font-semibold"
            >
              Volver al checkout
            </button>
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8 pb-12">
        <div
          className="w-full max-w-md space-y-5"
          style={{ animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
        >
          {!comprobanteEnviado ? (
            <>
              {/* Botón regresar arriba */}
              <div className="flex justify-start w-full">
                <button
                  type="button"
                  onClick={handleRegresar}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-semibold text-sm"
                  aria-label="Regresar"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Regresar
                </button>
              </div>

              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-dorado-oro/20 flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-7 h-7 text-dorado-oro" />
                </div>
                <h1 className="font-black text-xl text-gray-900 mb-1">Pago por transferencia</h1>
                <p className="text-sm text-gray-600">Transfiere el total y envía tu comprobante</p>
                <p className="text-xs text-gray-500 mt-2 font-mono">{orderNum} · ${confirmedTotal.toFixed(2)}</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Datos para transferencia</p>
                </div>
                <div className="p-4 space-y-2">
                  {transferencia?.cooperativa && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Cooperativa / Banco</span>
                      <span className="font-semibold text-gray-900">{transferencia.cooperativa}</span>
                    </div>
                  )}
                  {transferencia?.tipoCuenta && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Tipo</span>
                      <span className="font-semibold text-gray-900">{transferencia.tipoCuenta}</span>
                    </div>
                  )}
                  {transferencia?.titular && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Titular</span>
                      <span className="font-semibold text-gray-900">{transferencia.titular}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-100">
                    <span className="text-gray-500">Número de cuenta</span>
                    <span className="font-mono font-bold text-gray-900">{transferencia?.numeroCuenta ?? ''}</span>
                  </div>
                  {transferencia?.numeroCuenta && (
                    <button
                      type="button"
                      onClick={copiarCuenta}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-colors"
                    >
                      {copiadoCuenta ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copiar número de cuenta
                        </>
                      )}
                    </button>
                  )}
                </div>
                {transferencia?.codigoBase64 && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Código para pagar</p>
                    {transferencia.codigoMimeType?.startsWith('image/') ? (
                      getSafeImageSrc(transferencia.codigoBase64) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={getSafeImageSrc(transferencia.codigoBase64)}
                          alt="Código de pago"
                          className="w-full max-h-48 object-contain rounded-xl border border-gray-200 bg-white"
                        />
                      ) : (
                        <div className="w-full max-h-48 flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm">
                          Código de pago no disponible
                        </div>
                      )
                    ) : (
                      <a
                        href={transferencia.codigoBase64}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-sm"
                      >
                        <FileText className="w-4 h-4 text-red-600" />
                        Ver PDF del código
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Comprobante de pago</p>
                </div>
                <div className="p-4">
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      onChange={(e) => setComprobanteFile(e.target.files?.[0] ?? null)}
                    />
                    <span className="flex flex-col items-center justify-center gap-2 py-6 px-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-dorado-oro/50 hover:bg-amber-50/30 transition-colors cursor-pointer">
                      <Upload className="w-10 h-10 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">
                        {comprobanteFile ? 'Cambiar archivo' : 'Elegir PDF o captura'}
                      </span>
                      <span className="text-xs text-gray-500">PNG, JPG o PDF · máx. 10 MB</span>
                    </span>
                  </label>
                  {comprobanteFile && (
                    <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      {isImage ? (
                        <ComprobantePreview file={comprobanteFile} />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-6 h-6 text-red-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{comprobanteFile.name}</p>
                        <p className="text-xs text-gray-500">{(comprobanteFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleEnviarComprobante}
                disabled={!comprobanteFile}
                className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black text-base shadow-lg transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                <Upload className="w-5 h-5" />
                Enviar comprobante
              </button>

              <p className="text-center text-xs text-gray-500">O envía tu comprobante por</p>
              <a
                href={`https://wa.me/593992250333?text=${whatsappMsg}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-green-500 text-green-600 hover:bg-green-50 font-bold text-sm transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp
              </a>
            </>
          ) : (
            <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
                <Clock className="w-8 h-8 text-dorado-oro animate-pulse" />
              </div>
              <h2 className="font-black text-xl text-gray-900 mb-2">Esperando un momento</h2>
              <p className="text-gray-600 mb-1">Que el restaurante confirme tu pago.</p>
              <p className="text-sm text-gray-500">Serás redirigido al seguimiento de tu pedido.</p>
            </div>
          )}
        </div>
      </main>
    );
  }

  // === Formulario de checkout (no confirmado)
  if (confirmed && !postStep) {
    return null;
  }

  // === Carrito vacío: no redirigir, dar tiempo a Firestore y mostrar mensaje
  if (hydrated && cart.stops.length === 0 && !confirmed) {
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

  if (!allLoaded || stopsData.length === 0) return null;

  return (
    <main
      className={`min-h-screen bg-gray-50 flex flex-col transition-all duration-300 ${
        pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 shadow-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="font-bold text-lg text-gray-900">Detalle de entrega</h1>
          </div>
          {user && user.rol !== 'cliente' && (
            <button
              type="button"
              onClick={() => {
                if (user.rol === 'central') router.push('/panel/central');
                else if (user.rol === 'rider') router.push('/panel/rider');
                else if (user.rol === 'local') router.push((user as { localId?: string }).localId ? `/panel/restaurante/${(user as { localId?: string }).localId}` : '/panel/restaurante');
                else if (user.rol === 'maestro') router.push('/panel/maestro');
              }}
              className="text-sm text-rojo-andino hover:underline font-medium flex-shrink-0"
            >
              Volver al panel
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-4 pb-36">

        {/* Dirección + tiempo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-4">
            <div className="flex items-start gap-3 mb-3">
              {local?.logo && (
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  <LocalLogo src={local.logo} alt={local?.name ?? ''} fill className="object-contain" sizes="48px" iconClassName="w-5 h-5 text-rojo-andino/60" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{local?.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">Delivery {local?.time}</p>
                {stopsData.length > 1 && (
                  <p className="text-xs text-rojo-andino font-semibold mt-1">+ {stopsData.length - 1} {stopsData.length === 2 ? 'local más' : 'locales más'} en tu pedido</p>
                )}
              </div>
              <button
                onClick={() => router.back()}
                className="flex-shrink-0 text-rojo-andino"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Método de entrega: solo si es un solo local */}
            {numParadas === 1 && (
              <div className="border-t border-gray-50 pt-3 pb-3">
                <p className="text-xs text-gray-400 font-medium mb-2">Método de entrega</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('delivery')}
                    className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                      deliveryType === 'delivery' ? 'border-rojo-andino bg-rojo-andino/5' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Truck className={`w-5 h-5 flex-shrink-0 ${deliveryType === 'delivery' ? 'text-rojo-andino' : 'text-gray-400'}`} />
                    <span className={`text-sm font-semibold ${deliveryType === 'delivery' ? 'text-rojo-andino' : 'text-gray-700'}`}>Entrega a domicilio</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType('pickup')}
                    className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                      deliveryType === 'pickup' ? 'border-rojo-andino bg-rojo-andino/5' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Store className={`w-5 h-5 flex-shrink-0 ${deliveryType === 'pickup' ? 'text-rojo-andino' : 'text-gray-400'}`} />
                    <span className={`text-sm font-semibold ${deliveryType === 'pickup' ? 'text-rojo-andino' : 'text-gray-700'}`}>Retiro en local</span>
                  </button>
                </div>
              </div>
            )}

            {deliveryType === 'pickup' ? (
              <div className="border-t border-gray-50 pt-3 space-y-2">
                <p className="text-xs text-gray-400 font-medium mb-1">Retirarás en</p>
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rojo-andino flex-shrink-0" />
                  {formatDireccionCorta(local?.address ?? '') || 'Dirección del local'}
                </p>
                {userLocationLatLng && local && typeof local.lat === 'number' && typeof local.lng === 'number' && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-gray-500">
                      A {formatDistanceKm(haversineKm(userLocationLatLng.lat, userLocationLatLng.lng, local.lat, local.lng))} de ti
                    </p>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${local.lat},${local.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold text-rojo-andino hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      ¿Cómo llegar?
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-t border-gray-50 pt-3">
                <p className="text-xs text-gray-400 font-medium mb-2 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Dirección de entrega
                </p>
                <AddressSelector dark />
                {direcciones.length === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mt-2">
                    No tienes direcciones guardadas. Agrega una para que te podamos entregar.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowAgregarDireccion(true)}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-rojo-andino/40 bg-rojo-andino/5 text-rojo-andino font-semibold text-sm hover:bg-rojo-andino/10 transition-colors"
                >
                  <Plus className="w-4 h-4 flex-shrink-0" />
                  {direcciones.length === 0 ? 'Agregar mi dirección' : 'Agregar nueva dirección'}
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Medios de pago */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="font-bold text-sm text-gray-500 uppercase tracking-wide">Medios de pago</p>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              { key: 'efectivo' as const, label: 'Efectivo', sub: 'Pago al recibir', icon: Banknote },
              {
                key: 'transferencia' as const,
                label: 'Transferencia',
                sub: local?.transferencia && (local.transferencia.numeroCuenta || local.transferencia.cooperativa)
                  ? 'Banco / Cooperativa'
                  : 'No configurado por el negocio',
                icon: CreditCard,
                disabled: !local?.transferencia || (!local.transferencia.numeroCuenta && !local.transferencia.cooperativa),
              },
            ].map(({ key, label, sub, icon: Icon, disabled = false }) => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setPayment(key)}
                className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors ${
                  disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50/80'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  payment === key ? 'bg-rojo-andino/10' : 'bg-gray-100'
                }`}>
                  <Icon className={`w-5 h-5 ${payment === key ? 'text-rojo-andino' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${payment === key ? 'text-rojo-andino' : 'text-gray-800'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  payment === key ? 'border-rojo-andino' : 'border-gray-300'
                }`}>
                  {payment === key && (
                    <div className="w-2.5 h-2.5 rounded-full bg-rojo-andino" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Propina: solo para entrega a domicilio */}
        {deliveryType === 'delivery' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="font-bold text-sm text-gray-500 uppercase tracking-wide">
              Propina para quien reparte
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Irá directamente a su bolsillo</p>
          </div>
          <div className="px-4 py-4 flex gap-2 flex-wrap">
            {TIP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTip(opt.value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  tip === opt.value
                    ? 'bg-rojo-andino text-white shadow-md scale-[1.05]'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Resumen */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="font-bold text-sm text-gray-500 uppercase tracking-wide">Resumen</p>
          </div>
          <div className="px-4 py-4 space-y-2.5">
            {stopsData.length > 1 ? (
              stopsData.map((stop) => (
                <div key={stop.localId} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">{stop.local?.name}</p>
                  {stop.enrichedItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm text-gray-600">
                      <span>{item.qty}× {item.name}</span>
                      <span className="font-semibold text-gray-900">${(item.price * item.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              enrichedItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm text-gray-600">
                  <span>{item.qty}× {item.name}</span>
                  <span className="font-semibold text-gray-900">${(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))
            )}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Productos ({totalCount})</span>
                <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
              </div>
              {!isPickup && (
                <>
                  {tarifaAjustada && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Tarifa ajustada por distancia
                    </p>
                  )}
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Costo de envío</span>
                    <span className="font-semibold text-gray-900">${shipping.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm text-gray-600">
                <span>Coste de servicio</span>
                <span className="font-semibold text-gray-900">${serviceCost.toFixed(2)}</span>
              </div>
              {!isPickup && tip > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Propina</span>
                  <span className="font-semibold text-gray-900">${tip.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-100 flex justify-between font-black text-gray-900 text-lg">
                <span>Total</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Botón pedir */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent px-4 pb-6 pt-4">
        <div className="max-w-2xl mx-auto">
          {authError && (
            <p className="text-red-600 text-sm font-medium mb-3 text-center">{authError}</p>
          )}
          {!authLoading && !user && (
            <p className="text-amber-700 text-sm font-medium mb-3 text-center">
              Inicia sesión para realizar tu pedido.
            </p>
          )}
          {necesitaDireccion && (
            <p className="text-amber-700 text-sm font-medium mb-3 text-center">
              Agrega una dirección de entrega para continuar.
            </p>
          )}
          <LoadingButton
            type="button"
            onClick={handleOrder}
            loading={isOrdering}
            disabled={!puedePedir}
            className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black text-lg shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <Truck className="w-5 h-5" />
            {isOrdering ? 'Enviando…' : 'Pedir'}
            <span className="bg-white/20 rounded-xl px-3 py-0.5 font-black">
              ${grandTotal.toFixed(2)}
            </span>
          </LoadingButton>
        </div>
      </div>

      {showModalUbicacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-fade-in text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="font-bold text-lg text-gray-900 mb-2">Necesitamos tu ubicación</h3>
            <p className="text-sm text-gray-600 mb-5">Para calcular el envío y entrega, agrega o selecciona una dirección.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowModalUbicacion(false)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowModalUbicacion(false);
                  setShowAgregarDireccion(true);
                }}
                className="flex-1 py-3 rounded-xl bg-rojo-andino text-white font-bold text-sm hover:bg-rojo-andino/90 transition-colors"
              >
                Agregar dirección
              </button>
            </div>
          </div>
        </div>
      )}

      {showAgregarDireccion && (
        <AgregarDireccionModal
          onClose={() => setShowAgregarDireccion(false)}
          onGuardar={(d) => {
            addDireccion(d);
            setShowAgregarDireccion(false);
          }}
          telefonoUsuario={user?.telefono ?? null}
          initialLatLng={userLocationLatLng}
        />
      )}
    </main>
  );
}
