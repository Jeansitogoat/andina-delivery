'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Truck } from 'lucide-react';
import { getIdToken } from '@/lib/authToken';
import { isNightMode } from '@/lib/time';
import { formatWhatsAppLink } from '@/lib/utils/phone';
import { useToast } from '@/lib/ToastContext';

const RETRY_WINDOW_MS = 120_000;

interface BotonPedirRiderProps {
  orderId: string;
  direccion?: string;
  restaurante?: string;
  metodoPago?: 'efectivo' | 'transferencia';
  total?: number;
  costoEnvio?: number;
  onSolicitado?: () => void;
  esBatchLeader?: boolean;
  todosListosEnBatch?: boolean;
  /** Firestore: ya hay solicitud a central (transporte o legacy). */
  yaSolicitadoCentral?: boolean;
  /** Si hay rider asignado, no mostrar controles (el padre muestra la tarjeta). */
  riderId?: string | null;
}

export default function BotonPedirRider({
  orderId,
  direccion,
  restaurante,
  metodoPago,
  total,
  costoEnvio,
  onSolicitado,
  esBatchLeader = true,
  todosListosEnBatch = true,
  yaSolicitadoCentral = false,
  riderId = null,
}: BotonPedirRiderProps) {
  const { showToast } = useToast();
  const [solicitando, setSolicitando] = useState(false);
  const [solicitado, setSolicitado] = useState(yaSolicitadoCentral);
  const [showRetry, setShowRetry] = useState(false);
  const [bumpNonce, setBumpNonce] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBatchWaiting = esBatchLeader && !todosListosEnBatch;
  const canPedirRider = !isBatchWaiting;

  useEffect(() => {
    if (yaSolicitadoCentral) setSolicitado(true);
  }, [yaSolicitadoCentral, orderId]);

  useEffect(() => {
    if (riderId) {
      setShowRetry(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const waitingCentral = solicitado || yaSolicitadoCentral;
    if (!waitingCentral) {
      setShowRetry(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    setShowRetry(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowRetry(true), RETRY_WINDOW_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [riderId, solicitado, yaSolicitadoCentral, orderId, bumpNonce]);

  const isNight = useMemo(() => isNightMode(), []);
  const whatsappNumber = '593983511866';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const whatsappText = useMemo(() => {
    const lineas: string[] = [];
    lineas.push('NUEVA CARRERA - ANDINA (MODO NOCTURNO)');
    lineas.push('----------------------------------');
    lineas.push(`ID: #${orderId}`);
    if (restaurante) lineas.push(`Local: ${restaurante}`);
    const totalNum = typeof total === 'number' && !Number.isNaN(total) ? total : 0;
    const costoEnvioNum = typeof costoEnvio === 'number' && !Number.isNaN(costoEnvio) ? costoEnvio : totalNum;
    if (metodoPago === 'transferencia') {
      lineas.push(`💳 *PAGO POR TRANSFERENCIA* (Cobrar solo envío): $${costoEnvioNum}`);
    } else {
      lineas.push(`💰 *TOTAL A COBRAR:* $${totalNum}`);
    }
    if (direccion) lineas.push(`Direccion: ${direccion}`);
    lineas.push('----------------------------------');
    lineas.push(`RECLAMAR CARRERA AQUI: ${baseUrl}/claim/${orderId}`);
    const mensaje = lineas.join('\n');
    return encodeURIComponent(mensaje);
  }, [orderId, restaurante, direccion, baseUrl, metodoPago, total, costoEnvio]);

  const whatsappHref = `${formatWhatsAppLink(whatsappNumber)}?text=${whatsappText}`;

  async function parseErrorMessage(res: Response): Promise<string> {
    try {
      const j = (await res.json()) as { error?: string };
      if (typeof j.error === 'string' && j.error.trim()) return j.error.trim();
    } catch {
      // ignorar
    }
    if (res.status === 429) return 'Espera unos minutos antes de volver a notificar.';
    if (res.status === 403) return 'No tienes permiso para esta acción.';
    return 'No se pudo enviar. Revisa la conexión e intenta de nuevo.';
  }

  async function handlePedirRider(isRetry: boolean) {
    if (riderId || solicitando || !canPedirRider) return;
    if (isRetry && !showRetry && !yaSolicitadoCentral && !solicitado) return;
    setSolicitando(true);
    try {
      const token = await getIdToken();
      if (!token) {
        showToast({ type: 'error', message: 'Inicia sesión de nuevo para pedir rider.' });
        setSolicitando(false);
        return;
      }
      const res = await fetch(`/api/pedidos/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          isRetry ? { accion: 'solicitar_rider', isRetry: true } : { accion: 'solicitar_rider' }
        ),
      });
      if (res.ok) {
        setSolicitado(true);
        if (isRetry) {
          setBumpNonce((n) => n + 1);
          showToast({ type: 'success', message: 'Central re-notificada.' });
        } else {
          onSolicitado?.();
        }
        if (isNight && !isRetry) {
          window.open(whatsappHref, '_blank', 'noopener,noreferrer');
        }
      } else {
        const msg = await parseErrorMessage(res);
        showToast({ type: 'error', message: msg });
      }
    } catch {
      showToast({ type: 'error', message: 'Error de red. Intenta otra vez.' });
    } finally {
      setSolicitando(false);
    }
  }

  if (riderId) {
    return null;
  }

  if (solicitado || yaSolicitadoCentral) {
    if (showRetry) {
      return (
        <button
          type="button"
          onClick={() => handlePedirRider(true)}
          disabled={solicitando || !canPedirRider}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-70"
        >
          <Truck className="w-3.5 h-3.5" />
          {solicitando ? 'Enviando...' : 'Re-notificar Central (Pedido lento)'}
        </button>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-amber-100 text-amber-800">
        <Truck className="w-3.5 h-3.5" />
        Central avisada — esperando asignación…
      </span>
    );
  }

  if (isBatchWaiting) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-gray-100 text-gray-600">
        <Truck className="w-3.5 h-3.5" />
        Esperando otros locales
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => handlePedirRider(false)}
      disabled={solicitando || !canPedirRider}
      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-70"
    >
      <Truck className="w-3.5 h-3.5" />
      {solicitando ? 'Enviando...' : 'Pedir Rider'}
    </button>
  );
}
