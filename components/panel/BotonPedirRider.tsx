'use client';

import { useMemo, useState } from 'react';
import { Truck } from 'lucide-react';
import { getIdToken } from '@/lib/authToken';
import { isNightMode } from '@/lib/time';

interface BotonPedirRiderProps {
  orderId: string;
  direccion?: string;
  restaurante?: string;
  /** Método de pago para el mensaje al rider */
  metodoPago?: 'efectivo' | 'transferencia';
  /** Total del pedido (para mensaje efectivo) */
  total?: number;
  /** Costo de envío (para mensaje transferencia: cobrar solo envío) */
  costoEnvio?: number;
  onSolicitado?: () => void;
  /** Multi-stop: solo el local líder puede pedir rider */
  esBatchLeader?: boolean;
  /** Multi-stop: true cuando todos los pedidos del batch están en estado listo */
  todosListosEnBatch?: boolean;
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
}: BotonPedirRiderProps) {
  const [solicitando, setSolicitando] = useState(false);
  const [solicitado, setSolicitado] = useState(false);

  const isBatchWaiting = esBatchLeader && !todosListosEnBatch;
  const canPedirRider = !isBatchWaiting;

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

  const whatsappHref = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;

  async function handlePedirRider() {
    if (solicitado || solicitando || !canPedirRider) return;
    if (isNight) {
      window.open(whatsappHref, '_blank', 'noopener,noreferrer');
      return;
    }
    setSolicitando(true);
    try {
      const token = await getIdToken();
      if (!token) {
        setSolicitando(false);
        return;
      }
      const res = await fetch(`/api/pedidos/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado: 'esperando_rider' }),
      });
      if (res.ok) {
        setSolicitado(true);
        onSolicitado?.();
      }
    } catch {
      // silencioso
    } finally {
      setSolicitando(false);
    }
  }

  if (solicitado) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-amber-100 text-amber-800">
        <Truck className="w-3.5 h-3.5" />
        Esperando confirmación
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
      onClick={handlePedirRider}
      disabled={solicitando || !canPedirRider}
      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-70"
    >
      <Truck className="w-3.5 h-3.5" />
      {solicitando ? 'Enviando...' : 'Pedir Rider'}
    </button>
  );
}
