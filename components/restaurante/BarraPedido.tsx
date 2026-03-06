'use client';

interface Props {
  cantidad: number;
  subtotal: number;
  onVerPedido: () => void;
}

export default function BarraPedido({ cantidad, subtotal, onVerPedido }: Props) {
  if (cantidad === 0) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent"
      style={{ animation: 'slideUp 0.3s ease-out' }}
    >
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={onVerPedido}
          className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold text-base flex items-center gap-3 px-5 shadow-2xl transition-all active:scale-[0.98]"
        >
          <span className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center text-sm font-black flex-shrink-0">
            {cantidad}
          </span>
          <span className="flex-1 text-left">Ver mi pedido</span>
          <span className="font-bold">${subtotal.toFixed(2)}</span>
        </button>
      </div>
    </div>
  );
}
