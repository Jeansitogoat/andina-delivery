'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ShoppingBag, CheckCircle, Truck, Star, TrendingUp, Phone, ChevronRight, Bell } from 'lucide-react';
import { getSafeImageSrc } from '@/lib/validImageUrl';

type OrderStatus = 'nuevo' | 'preparando' | 'listo' | 'entregado';

interface Order {
  id: string;
  cliente: string;
  items: string[];
  total: number;
  tiempo: string;
  status: OrderStatus;
  direccion: string;
}

const INITIAL_ORDERS: Order[] = [
  {
    id: '#A-1042',
    cliente: 'Jean M.',
    items: ['Pollo a la brasa entero', 'Gaseosa 2L'],
    total: 14.50,
    tiempo: 'hace 2 min',
    status: 'nuevo',
    direccion: 'Sector La Cadena, Piñas',
  },
  {
    id: '#A-1041',
    cliente: 'María G.',
    items: ['1/4 de pollo + papas', 'Ensalada'],
    total: 8.25,
    tiempo: 'hace 8 min',
    status: 'preparando',
    direccion: 'Calle Sucre, Piñas',
  },
  {
    id: '#A-1040',
    cliente: 'Carlos R.',
    items: ['Combo familiar x2', 'Jugo natural'],
    total: 22.00,
    tiempo: 'hace 15 min',
    status: 'listo',
    direccion: 'Frente al Parque Central',
  },
  {
    id: '#A-1039',
    cliente: 'Ana P.',
    items: ['Pechuga a la plancha', 'Arroz con menestra'],
    total: 7.50,
    tiempo: 'hace 32 min',
    status: 'entregado',
    direccion: 'Av. 9 de Octubre, Piñas',
  },
];

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; next?: OrderStatus; nextLabel?: string }> = {
  nuevo: {
    label: 'Nuevo',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    next: 'preparando',
    nextLabel: 'Aceptar pedido',
  },
  preparando: {
    label: 'En preparación',
    color: 'text-dorado-oro',
    bg: 'bg-yellow-50 border-yellow-200',
    next: 'listo',
    nextLabel: 'Marcar listo',
  },
  listo: {
    label: 'Listo para entregar',
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
    next: 'entregado',
    nextLabel: 'Entregado',
  },
  entregado: {
    label: 'Entregado',
    color: 'text-gray-500',
    bg: 'bg-gray-50 border-gray-200',
  },
};

interface BusinessPanelProps {
  isOpen: boolean;
  onClose: () => void;
  localName?: string;
  localLogo?: string;
}

export default function BusinessPanel({ isOpen, onClose, localName = 'Tu negocio', localLogo }: BusinessPanelProps) {
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [tab, setTab] = useState<'pedidos' | 'stats'>('pedidos');
  const [newOrderToast, setNewOrderToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      const newOrder: Order = {
        id: '#A-1043',
        cliente: 'Pedro S.',
        items: ['Pollo a la brasa (1/2)', 'Gaseosa'],
        total: 9.50,
        tiempo: 'ahora',
        status: 'nuevo',
        direccion: 'Av. 9 de Octubre, Piñas',
      };
      setOrders((prev) => [newOrder, ...prev]);
      setNewOrderToast('#A-1043');
      setTimeout(() => setNewOrderToast(null), 4000);
    }, 3500);
    return () => clearTimeout(t);
  }, [isOpen]);

  if (!isOpen) return null;

  const activeOrders = orders.filter((o) => o.status !== 'entregado');
  const delivered = orders.filter((o) => o.status === 'entregado');
  const todayEarnings = orders.reduce((s, o) => s + (o.status === 'entregado' ? o.total : 0), 0);

  function advanceStatus(id: string) {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const cfg = STATUS_CONFIG[o.status];
        return cfg.next ? { ...o, status: cfg.next } : o;
      })
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        className="relative flex-1 mt-10 bg-gray-50 rounded-t-[2rem] overflow-hidden flex flex-col"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header del panel */}
        <div className="bg-rojo-andino text-white px-5 pt-5 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {getSafeImageSrc(localLogo) ? (
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white flex-shrink-0">
                  <Image src={getSafeImageSrc(localLogo)!} alt={localName} fill className="object-contain" sizes="48px" unoptimized={localLogo?.startsWith('data:')} />
                </div>
              ) : null}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-dorado-oro text-gray-900 font-bold text-sm px-2 py-0.5 rounded-md">ANDINA</span>
                  <span className="font-semibold text-sm">Panel del negocio</span>
                </div>
                <h2 className="font-bold text-xl">{localName}</h2>
                <div className="flex items-center gap-3 mt-1 text-white/80 text-xs">
                  <span className="flex items-center gap-1"><Star className="w-3 h-3 text-dorado-oro fill-dorado-oro" /> 4.8</span>
                  <span className="flex items-center gap-1"><Bell className="w-3 h-3" /> {activeOrders.length} activos</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats rápidas */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: ShoppingBag, label: 'Pedidos hoy', value: String(orders.length) },
              { icon: CheckCircle, label: 'Entregados', value: String(delivered.length) },
              { icon: TrendingUp, label: 'Ganado hoy', value: `$${todayEarnings.toFixed(2)}` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/15 rounded-2xl p-3 text-center">
                <Icon className="w-4 h-4 text-dorado-oro mx-auto mb-1" />
                <p className="font-bold text-base">{value}</p>
                <p className="text-white/70 text-xs">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white px-5">
          {(['pedidos', 'stats'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`py-3 px-4 text-sm font-semibold capitalize border-b-2 transition-colors ${
                tab === t ? 'border-rojo-andino text-rojo-andino' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'pedidos' ? (
                <span className="flex items-center gap-1.5">
                  Pedidos
                  {activeOrders.filter(o => o.status === 'nuevo').length > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rojo-andino text-white text-[10px] font-bold animate-pulse">
                      {activeOrders.filter(o => o.status === 'nuevo').length}
                    </span>
                  )}
                </span>
              ) : 'Mi negocio'}
            </button>
          ))}
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Toast nuevo pedido */}
          {newOrderToast && (
            <div className="animate-fade-in flex items-center gap-3 bg-rojo-andino text-white rounded-2xl px-4 py-3 shadow-lg">
              <Bell className="w-5 h-5 text-dorado-oro flex-shrink-0 animate-bounce" />
              <div>
                <p className="font-bold text-sm">¡Nuevo pedido recibido!</p>
                <p className="text-xs text-white/80">{newOrderToast} · Pedro S.</p>
              </div>
            </div>
          )}

          {tab === 'pedidos' ? (
            <>
              {activeOrders.length === 0 && (
                <div className="py-12 text-center text-gray-400">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Sin pedidos activos</p>
                </div>
              )}

              {/* Pedidos activos */}
              {activeOrders.map((order) => {
                const cfg = STATUS_CONFIG[order.status];
                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl border p-4 shadow-sm ${order.status === 'nuevo' ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-100'}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">{order.id}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{order.cliente} · {order.tiempo}</p>
                      </div>
                      <span className="font-bold text-rojo-andino">${order.total.toFixed(2)}</span>
                    </div>

                    <ul className="text-sm text-gray-700 mb-3 space-y-0.5">
                      {order.items.map((item) => (
                        <li key={item} className="flex items-center gap-1.5">
                          <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Truck className="w-3.5 h-3.5 text-dorado-oro" />
                        <span>{order.direccion}</span>
                      </div>
                      {cfg.next && (
                        <button
                          type="button"
                          onClick={() => advanceStatus(order.id)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                            order.status === 'nuevo'
                              ? 'bg-rojo-andino text-white hover:bg-rojo-andino/90'
                              : order.status === 'preparando'
                              ? 'bg-dorado-oro text-gray-900 hover:bg-dorado-oro/90'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {cfg.nextLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Historial */}
              {delivered.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Historial de hoy</p>
                  {delivered.map((order) => (
                    <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-4 opacity-60">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-gray-700 text-sm">{order.id}</span>
                          <p className="text-xs text-gray-400">{order.cliente} · {order.tiempo}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-700">${order.total.toFixed(2)}</p>
                          <span className="text-xs text-green-600 font-semibold">✓ Entregado</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            /* Tab: Mi negocio */
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-3">Información del local</h3>
                <div className="space-y-3 text-sm text-gray-700">
                  {[
                    { label: 'Nombre', value: 'RHK Asadero Restaurant' },
                    { label: 'Categoría', value: 'Restaurantes' },
                    { label: 'Horario', value: 'Lun–Sáb · 11:00–21:00' },
                    { label: 'Tiempo promedio', value: '25-35 min' },
                    { label: 'Costo de envío', value: '$1.25' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-3">Resumen de la semana</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Pedidos', value: '47' },
                    { label: 'Ingresos', value: '$312.50' },
                    { label: 'Calificación', value: '4.8 ★' },
                    { label: 'Clientes nuevos', value: '12' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="font-bold text-lg text-rojo-andino">{value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-dorado-oro/10 border border-dorado-oro/30 rounded-2xl p-4 flex items-start gap-3">
                <Phone className="w-5 h-5 text-dorado-oro flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-gray-900">¿Necesitas ayuda?</p>
                  <p className="text-gray-500 text-xs mt-0.5">Contacta al equipo Andina</p>
                  <a href="tel:+593992250333" className="text-rojo-andino font-bold text-sm mt-1 block">https://wa.me/593992250333</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
