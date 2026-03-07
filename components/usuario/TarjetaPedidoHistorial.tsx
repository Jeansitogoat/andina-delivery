'use client';

import { ShoppingBag, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import LocalLogo from '@/components/LocalLogo';

export interface PedidoHistorial {
  id: string;
  fecha: string;
  restaurante: string;
  logoRestaurante: string;
  items: string[];
  total: number;
  estado: 'entregado' | 'cancelado' | 'en_camino' | 'preparando';
  tiempo: string;
}

interface TarjetaPedidoHistorialProps {
  pedido: PedidoHistorial;
  onVolverAPedir: (_pedido: PedidoHistorial) => void;
}

export default function TarjetaPedidoHistorial({ pedido, onVolverAPedir }: TarjetaPedidoHistorialProps) {
  const entregado = pedido.estado === 'entregado';
  const cancelado = pedido.estado === 'cancelado';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
          {pedido.logoRestaurante ? (
            <LocalLogo src={pedido.logoRestaurante} alt={pedido.restaurante} fill className="object-contain" sizes="48px" iconClassName="w-6 h-6 text-gray-400" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 text-sm">{pedido.id}</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                entregado
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : cancelado
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              }`}
            >
              {entregado ? 'Entregado' : cancelado ? 'Cancelado' : pedido.estado}
            </span>
          </div>
          <p className="font-semibold text-gray-900 text-sm mt-0.5">{pedido.restaurante}</p>
          <p className="text-xs text-gray-500 mt-0.5">{pedido.fecha}</p>
          <ul className="text-xs text-gray-600 mt-1.5 space-y-0.5">
            {pedido.items.slice(0, 3).map((item) => (
              <li key={item} className="truncate">
                {item}
              </li>
            ))}
            {pedido.items.length > 3 && (
              <li className="text-gray-400">+{pedido.items.length - 3} más</li>
            )}
          </ul>
          <div className="flex items-center justify-between mt-3">
            <span className="font-bold text-rojo-andino text-sm">${pedido.total.toFixed(2)}</span>
            {entregado && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                {pedido.tiempo}
              </span>
            )}
            {cancelado && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                {pedido.tiempo}
              </span>
            )}
          </div>
        </div>
      </div>
      {entregado && (
        <button
          type="button"
          onClick={() => onVolverAPedir(pedido)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 border-t border-gray-100 text-rojo-andino font-semibold text-sm transition-colors"
        >
          Volver a pedir
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
