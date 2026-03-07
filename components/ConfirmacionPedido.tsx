'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, Clock, Truck, Bell } from 'lucide-react';
import { useNotifications } from '@/lib/useNotifications';
import { formatDireccionCorta } from '@/lib/formatDireccion';
import { sendNotification, showLocalNotification, canShowLocalNotification, DEMO_NEED_PERMISSION_MESSAGE } from '@/lib/notifications';

export interface ItemConfirmado {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface ConfirmacionPedidoProps {
  orderNum: string;
  localName?: string;
  localTime?: string;
  direccionEntregar: string;
  enrichedItems: ItemConfirmado[];
  grandTotal: number;
}

export default function ConfirmacionPedido({
  orderNum,
  localName,
  localTime,
  direccionEntregar,
  enrichedItems,
  grandTotal,
}: ConfirmacionPedidoProps) {
  const router = useRouter();
  const [demoToast, setDemoToast] = useState('');
  const { permission, requestPermission, loading: notifLoading, error: notifError } = useNotifications('user');

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center"
        style={{ animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
      >
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-11 h-11 text-green-500" />
        </div>
        <h2 className="font-black text-2xl text-gray-900 mb-2">¡Pedido confirmado!</h2>
        <p className="text-gray-500 text-sm mb-1">{orderNum}</p>
        {localName && <p className="text-gray-700 font-semibold text-sm mb-6">{localName}</p>}

        <div className="flex items-center justify-center gap-2 bg-dorado-oro/10 border border-dorado-oro/30 rounded-2xl py-3 px-5 mb-6">
          <Clock className="w-5 h-5 text-dorado-oro" />
          <span className="text-sm font-semibold text-gray-800">
            Tiempo estimado: <span className="text-rojo-andino font-black">{localTime ?? '25-35 min'}</span>
          </span>
        </div>

        <div className="flex items-center gap-3 bg-rojo-andino/5 border border-rojo-andino/15 rounded-2xl p-4 mb-6 text-left">
          <div className="w-10 h-10 rounded-full bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5 text-rojo-andino" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Cía. Virgen de la Merced</p>
            <p className="text-xs text-gray-500 mt-0.5">Tu pedido está en camino · {formatDireccionCorta(direccionEntregar)}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left space-y-1.5">
          {enrichedItems.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-600">{item.qty}× {item.name}</span>
              <span className="font-semibold text-gray-900">${(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-200 flex justify-between font-black text-gray-900 text-base">
            <span>Total pagado</span>
            <span>${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {(permission === 'default' || permission === 'denied') && (
          <div className="mb-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 text-left">
            <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Bell className="w-4 h-4 text-dorado-oro" />
              ¿Recibir actualizaciones del pedido?
            </p>
            <p className="text-xs text-gray-500 mb-3">{notifError ?? 'Te avisaremos cuando esté en preparación y cuando vaya en camino.'}</p>
            <button
              type="button"
              onClick={requestPermission}
              disabled={notifLoading}
              className="w-full py-2.5 rounded-xl bg-dorado-oro/20 text-dorado-oro font-bold text-sm hover:bg-dorado-oro/30 transition-colors disabled:opacity-70"
            >
              {notifLoading ? 'Activando...' : 'Activar notificaciones'}
            </button>
          </div>
        )}
        {permission === 'granted' && (
          <p className="text-xs text-gray-500 mb-3 flex items-center justify-center gap-1">
            <Bell className="w-3.5 h-3.5 text-green-500" />
            Recibirás actualizaciones del pedido
          </p>
        )}

        {demoToast && (
          <div className="mb-4 flex items-center gap-3 bg-gray-800 text-white rounded-2xl px-4 py-3">
            <Bell className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <p className="text-sm">{demoToast}</p>
          </div>
        )}

        <a
          href="https://wa.me/593992250333"
          target="_blank"
          rel="noreferrer"
          className="block w-full py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm mb-3 transition-colors"
        >
          Contactar por WhatsApp
        </a>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full py-3.5 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm transition-colors"
        >
          Volver al inicio
        </button>

        {/* Probar notificaciones (demo) — quitar cuando el backend envíe las reales */}
        <div className="mt-6 pt-4 border-t border-gray-100 text-left">
          <p className="text-xs text-gray-400 font-semibold mb-2">Probar notificaciones (demo)</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!canShowLocalNotification()) {
                  setDemoToast(DEMO_NEED_PERMISSION_MESSAGE);
                  setTimeout(() => setDemoToast(''), 3500);
                  return;
                }
                sendNotification({ target: 'user', title: 'Tu pedido se está preparando', body: 'El restaurante está cocinando.' });
                showLocalNotification('Tu pedido se está preparando', 'El restaurante está cocinando.');
              }}
              className="text-xs px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Preparando
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canShowLocalNotification()) {
                  setDemoToast(DEMO_NEED_PERMISSION_MESSAGE);
                  setTimeout(() => setDemoToast(''), 3500);
                  return;
                }
                sendNotification({ target: 'user', title: 'Tu pedido va en camino', body: 'El rider está llevando tu pedido.' });
                showLocalNotification('Tu pedido va en camino', 'El rider está llevando tu pedido.');
              }}
              className="text-xs px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              En camino
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canShowLocalNotification()) {
                  setDemoToast(DEMO_NEED_PERMISSION_MESSAGE);
                  setTimeout(() => setDemoToast(''), 3500);
                  return;
                }
                sendNotification({ target: 'user', title: '¡Pedido entregado!', body: 'Que lo disfrutes.' });
                showLocalNotification('¡Pedido entregado!', 'Que lo disfrutes.');
              }}
              className="text-xs px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Entregado
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </main>
  );
}
