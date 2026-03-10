'use client';

import { useMemo, useState } from 'react';
import { Truck } from 'lucide-react';
import { getIdToken } from '@/lib/authToken';
import { isNightMode } from '@/lib/time';

interface BotonPedirRiderProps {
  orderId: string;
  direccion?: string;
  restaurante?: string;
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
  const claimBaseUrl = typeof process.env.NEXT_PUBLIC_APP_URL === 'string' && process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
    : 'https://andina-express.vercel.app';

  const whatsappText = useMemo(() => {
    const parts: string[] = [];
    parts.push('NUEVA CARRERA - ANDINA (MODO NOCTURNO)');
    parts.push('----------------------------------');
    parts.push(`ID: #${orderId}`);
    if (restaurante) parts.push(`Local: ${restaurante}`);
    parts.push('Total:');
    if (direccion) parts.push(`Direccion: ${direccion}`);
    parts.push('----------------------------------');
    parts.push(`RECLAMAR CARRERA AQUI: ${claimBaseUrl}/claim/${orderId}`);
    return encodeURIComponent(parts.join('\\n'));
  }, [orderId, restaurante, direccion, claimBaseUrl]);

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
