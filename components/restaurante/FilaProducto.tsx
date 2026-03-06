'use client';

import Image from 'next/image';
import { Flame, Plus, Minus, ShoppingBag } from 'lucide-react';
import type { MenuItem } from '@/lib/data';
import { getSafeImageSrc } from '@/lib/validImageUrl';

interface Props {
  item: MenuItem;
  inCart: number;
  isLast: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onRemove: () => void;
}

export default function FilaProducto({ item, inCart, isLast, onOpen, onAdd, onRemove }: Props) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-gray-50/80 transition-colors ${
        !isLast ? 'border-b border-gray-50' : ''
      }`}
      onClick={onOpen}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {item.bestseller && (
            <span className="flex items-center gap-0.5 bg-rojo-andino/10 text-rojo-andino text-[10px] font-bold px-1.5 py-0.5 rounded-lg flex-shrink-0">
              <Flame className="w-2.5 h-2.5" />
              Más vendido
            </span>
          )}
        </div>
        <p className="font-semibold text-gray-900 text-sm leading-snug">{item.name}</p>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{item.description}</p>
        )}
        <p className="font-bold text-gray-900 text-sm mt-1.5">${item.price.toFixed(2)}</p>
      </div>

      <div className="relative flex-shrink-0">
        <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
          {getSafeImageSrc(item.image) ? (
            <Image src={getSafeImageSrc(item.image)!} alt={item.name} fill className="object-cover" sizes="96px" unoptimized={item.image?.startsWith('data:')} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-gray-300" />
            </div>
          )}
        </div>

        <div
          className="absolute -bottom-2 -right-2 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {inCart > 0 ? (
            <div className="flex items-center gap-1 bg-white rounded-xl shadow-lg border border-gray-100 px-1 py-0.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="w-6 h-6 rounded-lg bg-rojo-andino/10 text-rojo-andino flex items-center justify-center hover:bg-rojo-andino/20 transition-colors active:scale-90"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-black text-gray-900 text-xs w-4 text-center">{inCart}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                className="w-6 h-6 rounded-lg bg-rojo-andino text-white flex items-center justify-center hover:bg-rojo-andino/90 transition-colors active:scale-90"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              className="w-8 h-8 rounded-xl bg-rojo-andino text-white flex items-center justify-center shadow-lg hover:bg-rojo-andino/90 transition-all active:scale-90 hover:scale-110"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
