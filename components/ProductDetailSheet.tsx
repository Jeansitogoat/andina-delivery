'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Plus, Minus, Flame, ShoppingBag } from 'lucide-react';
import type { MenuItem } from '@/lib/data';
import { getSafeImageSrc } from '@/lib/validImageUrl';
import type { AddItemOptions } from '@/lib/cartContext';

interface ProductDetailSheetProps {
  item: MenuItem | null;
  localId: string;
  currentQty: number;
  onClose: () => void;
  onAdd: (_localId: string, _itemId: string, _note?: string, _options?: AddItemOptions) => void;
  onRemove: (_itemId: string, _localId?: string, _options?: Pick<AddItemOptions, 'variationName' | 'complementSelections'>) => void;
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
  const [selectedVariationIndex, setSelectedVariationIndex] = useState<number | null>(null);
  const [selectedComplementos, setSelectedComplementos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (item) {
      setQty(currentQty > 0 ? currentQty : 1);
      setNote('');
      // Importante: que el usuario NO llegue con nada preseleccionado.
      // El botón "Agregar" debe quedar deshabilitado hasta completar las opciones obligatorias.
      setSelectedVariationIndex(null);
      setSelectedComplementos({});
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [item, currentQty]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const hasVariaciones = !!(item?.tieneVariaciones && item.variaciones?.length);
  const hasComplementos = !!(item?.tieneComplementos && item.complementos?.length);
  const selectedVariation = hasVariaciones && item && selectedVariationIndex != null && item.variaciones?.[selectedVariationIndex];
  // Si hay variaciones pero el usuario no eligió ninguna, no mostramos precio base.
  const effectivePrice = selectedVariation
    ? selectedVariation.price
    : hasVariaciones
      ? 0
      : item?.price ?? 0;
  const variacionValid = !hasVariaciones || selectedVariationIndex != null;
  const complementosValid =
    !hasComplementos ||
    (item?.complementos?.every((g) => selectedComplementos[g.groupLabel]?.trim()) ?? true);
  const canAdd = variacionValid && complementosValid;

  const buildOptions = (): AddItemOptions | undefined => {
    if (!item) return undefined;
    if (!hasVariaciones && !hasComplementos) return undefined;
    const opts: AddItemOptions = {};
    if (selectedVariation) {
      opts.variationName = selectedVariation.name;
      opts.variationPrice = selectedVariation.price;
    }
    if (Object.keys(selectedComplementos).length > 0) opts.complementSelections = { ...selectedComplementos };
    return Object.keys(opts).length > 0 ? opts : undefined;
  };

  const handleAdd = () => {
    if (!item) return;
    const options = buildOptions();
    const diff = qty - currentQty;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) onAdd(localId, item.id, note || undefined, options);
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) onRemove(item.id, localId, options);
    } else if (currentQty === 0) {
      onAdd(localId, item.id, note || undefined, options);
    }
    handleClose();
  };

  if (!item) return null;

  const totalText = hasVariaciones && !selectedVariation ? '—' : `$${(effectivePrice * qty).toFixed(2)}`;

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

      {/* Sheet - overflow-hidden para recorte curvo de la imagen superior */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white rounded-t-[2rem] shadow-2xl transition-transform duration-300 ease-out max-h-[92vh] overflow-hidden ${
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
          {/* Imagen - object-cover + overflow padre recorta a la curva del sheet */}
          <div className="relative w-full bg-gray-100 overflow-hidden" style={{ aspectRatio: '4/3' }}>
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
            {!hasVariaciones && <p className="text-rojo-andino font-bold text-2xl mt-3">${item.price.toFixed(2)}</p>}
            {hasVariaciones && (
              <p className="text-rojo-andino font-bold text-2xl mt-3">
                {selectedVariation ? `$${selectedVariation.price.toFixed(2)}` : 'Elige una opción'}
              </p>
            )}

            {/* Variaciones — Chips */}
            {hasVariaciones && item.variaciones && (
              <div className="mt-4">
                <p className="font-semibold text-gray-800 text-sm mb-2">Tamaño / variación</p>
                <div className="flex flex-wrap gap-2">
                  {item.variaciones.map((v, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedVariationIndex(idx)}
                      className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                        selectedVariationIndex === idx
                          ? 'bg-rojo-andino text-white border-rojo-andino shadow-md'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="text-gray-900">{v.name}</span>
                        <span className={selectedVariationIndex === idx ? 'text-white/85' : 'text-gray-500'}>
                          ${v.price.toFixed(2)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Complementos — Lista de selección */}
            {hasComplementos && item.complementos && (
              <div className="mt-5 space-y-4">
                {item.complementos.map((g) => (
                  <div
                    key={g.groupLabel}
                    className="p-4 rounded-3xl overflow-hidden bg-gray-50/70 border border-gray-100"
                  >
                    <p className="font-semibold text-gray-800 text-sm mb-3">{g.groupLabel}</p>
                    <div className="space-y-2">
                      {g.options.map((opt) => (
                        <label
                          key={opt}
                          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-colors ${
                            selectedComplementos[g.groupLabel] === opt
                              ? 'border-rojo-andino bg-rojo-andino/5'
                              : 'border-gray-200 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`complement-${g.groupLabel}`}
                            checked={selectedComplementos[g.groupLabel] === opt}
                            onChange={() => setSelectedComplementos((prev) => ({ ...prev, [g.groupLabel]: opt }))}
                            className="w-4 h-4 text-rojo-andino border-gray-300 focus:ring-rojo-andino"
                          />
                          <span className="text-sm font-medium text-gray-900">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

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
            disabled={!canAdd}
            className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold text-base flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rojo-andino"
          >
            <span className="bg-white/20 rounded-xl px-2 py-0.5 text-sm font-black">{qty}</span>
            Agregar a mi pedido
            <span className="ml-auto font-bold">{totalText}</span>
          </button>
          )}
          {!canAdd && (hasVariaciones || hasComplementos) && (
            <p className="text-center text-xs text-gray-500 mt-2">Elige las opciones indicadas para continuar</p>
          )}
        </div>
      </div>
    </>
  );
}
