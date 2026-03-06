'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Plus, Minus, Flame, ShoppingBag } from 'lucide-react';
import type { MenuItem } from '@/lib/data';
import { getSafeImageSrc } from '@/lib/validImageUrl';

interface ProductDetailSheetProps {
  item: MenuItem | null;
  localId: string;
  currentQty: number;
  onClose: () => void;
  onAdd: (localId: string, itemId: string, note?: string) => void;
  onRemove: (itemId: string) => void;
  cerrado?: boolean;
  cerradoMensaje?: string;
  cerradoAbreA?: string;
}

export default function ProductDetailSheet({
  item,
  localId,
  currentQty,
  onClose,
  onAdd,
  onRemove,
  cerrado,
  cerradoMensaje,
  cerradoAbreA,
}: ProductDetailSheetProps) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (item) {
      setQty(currentQty > 0 ? currentQty : 1);
      setNote('');
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [item, currentQty]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const handleAdd = () => {
    if (!item) return;
    const diff = qty - currentQty;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) onAdd(localId, item.id, note || undefined);
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) onRemove(item.id);
    } else if (currentQty === 0) {
      onAdd(localId, item.id, note || undefined);
    }
    handleClose();
  };

  if (!item) return null;

  const total = (item.price * qty).toFixed(2);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white rounded-t-[2rem] shadow-2xl transition-transform duration-300 ease-out max-h-[92vh] ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxWidth: '600px', margin: '0 auto' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Scroll area */}
        <div className="overflow-y-auto flex-1">
          {/* Imagen */}
          <div className="relative w-full bg-gray-100" style={{ aspectRatio: '4/3' }}>
            {getSafeImageSrc(item.image) ? (
              <Image
                src={getSafeImageSrc(item.image)!}
                alt={item.name}
                fill
                className="object-cover"
                sizes="(max-width: 600px) 100vw, 600px"
                priority
                unoptimized={item.image?.startsWith('data:')}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <ShoppingBag className="w-16 h-16 text-gray-300" />
              </div>
            )}
            {item.bestseller && (
              <span className="absolute top-4 left-4 flex items-center gap-1.5 bg-rojo-andino text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg">
                <Flame className="w-3.5 h-3.5" />
                Más pedido
              </span>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors backdrop-blur-sm"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Contenido */}
          <div className="px-5 pt-5 pb-4">
            {cerrado && (cerradoMensaje || cerradoAbreA) && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
                {cerradoMensaje && <p className="font-semibold text-amber-900 text-sm">{cerradoMensaje}</p>}
                {cerradoAbreA && <p className="text-amber-800 text-xs mt-1">{cerradoAbreA}</p>}
              </div>
            )}
            <h2 className="font-bold text-2xl text-gray-900 leading-tight">{item.name}</h2>
            {item.description && (
              <p className="text-gray-500 text-base mt-2 leading-relaxed">{item.description}</p>
            )}
            <p className="text-rojo-andino font-bold text-2xl mt-3">${item.price.toFixed(2)}</p>

            {/* Selector de cantidad */}
            <div className="mt-6 flex items-center justify-between">
              <span className="font-semibold text-gray-800 text-base">Unidades</span>
              <div className="flex items-center gap-4 bg-gray-50 rounded-2xl px-4 py-2.5 border border-gray-100">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm active:scale-90 disabled:opacity-40"
                  disabled={qty <= 1}
                >
                  <Minus className="w-4 h-4 text-gray-700" />
                </button>
                <span className="font-bold text-gray-900 text-lg w-6 text-center">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => q + 1)}
                  className="w-8 h-8 rounded-full bg-rojo-andino flex items-center justify-center hover:bg-rojo-andino/90 transition-colors shadow-md active:scale-90"
                >
                  <Plus className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Notas */}
            <div className="mt-5">
              <p className="font-semibold text-gray-800 text-sm mb-1.5">Notas para este producto</p>
              <p className="text-xs text-gray-400 mb-2">El local intentará seguirlas cuando lo prepare.</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Escribe las instrucciones que necesites..."
                rows={3}
                maxLength={200}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30 focus:border-rojo-andino text-sm resize-none transition-colors"
              />
              <div className="text-right text-xs text-gray-300 mt-1">{note.length}/200</div>
            </div>
          </div>
        </div>

        {/* Botón agregar — fijo al bottom */}
        <div className="flex-shrink-0 px-5 py-4 bg-white border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          {cerrado ? (
            <div className="w-full py-4 rounded-2xl bg-gray-200 text-gray-500 font-semibold text-center text-sm">
              No está recibiendo pedidos ahora
            </div>
          ) : (
          <button
            type="button"
            onClick={handleAdd}
            className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold text-base flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg"
          >
            <span className="bg-white/20 rounded-xl px-2 py-0.5 text-sm font-black">{qty}</span>
            Agregar a mi pedido
            <span className="ml-auto font-bold">${total}</span>
          </button>
          )}
        </div>
      </div>
    </>
  );
}
