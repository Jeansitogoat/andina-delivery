'use client';

import Image from 'next/image';
import { X, Plus, Minus, ShoppingBag, Star, Clock, Truck, Flame } from 'lucide-react';
import LocalLogo from '@/components/LocalLogo';
import { getSafeImageSrc } from '@/lib/validImageUrl';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  bestseller?: boolean;
}

export interface Review {
  author: string;
  rating: number;
  comment: string;
}

export interface LocalInfo {
  id: string;
  name: string;
  rating: number;
  reviews?: number;
  time: string;
  shipping: number;
  logo?: string;
  cover?: string;
}

interface MenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  local: LocalInfo;
  items: MenuItem[];
  cart: { id: string; qty: number }[];
  onAdd: (_id: string) => void;
  onRemove: (_id: string) => void;
  onCheckout: () => void;
  reviewsList?: Review[];
}

function ItemCard({
  item,
  qty,
  onAdd,
  onRemove,
  compact = false,
}: {
  item: MenuItem;
  qty: number;
  onAdd: (_id: string) => void;
  onRemove: (_id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 bg-white ${compact ? 'rounded-2xl border border-gray-100 p-3 w-52 flex-shrink-0 flex-col items-start' : 'px-5 py-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors'}`}>
      {getSafeImageSrc(item.image) ? (
        <div className={`relative rounded-2xl overflow-hidden bg-gray-100 shadow-sm flex-shrink-0 ${compact ? 'w-full h-32' : 'w-24 h-24'}`}>
          <Image src={getSafeImageSrc(item.image)!} alt={item.name} fill className="object-cover" sizes={compact ? '208px' : '96px'} unoptimized={item.image?.startsWith('data:')} />
          {item.bestseller && (
            <span className="absolute top-2 left-2 flex items-center gap-1 bg-rojo-andino text-white text-[10px] font-bold px-1.5 py-0.5 rounded-lg">
              <Flame className="w-2.5 h-2.5" /> Más pedido
            </span>
          )}
        </div>
      ) : null}
      <div className={`flex-1 min-w-0 ${compact ? 'w-full' : ''}`}>
        <div className="flex items-start gap-1">
          <p className={`font-bold text-gray-900 leading-tight flex-1 ${compact ? 'text-sm' : 'text-base'}`}>{item.name}</p>
          {item.bestseller && !getSafeImageSrc(item.image) && (
            <span className="flex-shrink-0 flex items-center gap-0.5 bg-rojo-andino/10 text-rojo-andino text-[10px] font-bold px-1.5 py-0.5 rounded-lg">
              <Flame className="w-2.5 h-2.5" /> Popular
            </span>
          )}
        </div>
        {item.description && (
          <p className={`text-gray-500 mt-0.5 line-clamp-2 ${compact ? 'text-xs' : 'text-sm'}`}>{item.description}</p>
        )}
        <div className={`flex items-center ${compact ? 'justify-between mt-2' : 'justify-between mt-2'}`}>
          <p className={`text-rojo-andino font-bold ${compact ? 'text-sm' : 'text-base'}`}>${item.price.toFixed(2)}</p>
          <div className="flex items-center gap-1">
            {qty > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="w-7 h-7 rounded-full bg-rojo-andino/10 text-rojo-andino flex items-center justify-center hover:bg-rojo-andino/20 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-5 text-center font-bold text-gray-900 text-sm">{qty}</span>
                <button
                  type="button"
                  onClick={() => onAdd(item.id)}
                  className="w-7 h-7 rounded-full bg-rojo-andino text-white flex items-center justify-center hover:bg-rojo-andino/90 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onAdd(item.id)}
                className="w-7 h-7 rounded-full bg-rojo-andino text-white flex items-center justify-center hover:bg-rojo-andino/90 transition-colors shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MenuModal({
  isOpen,
  onClose,
  local,
  items,
  cart,
  onAdd,
  onRemove,
  onCheckout,
  reviewsList,
}: MenuModalProps) {
  if (!isOpen) return null;

  const totalItems = cart.reduce((s, c) => s + c.qty, 0);
  const subtotal = cart.reduce((s, c) => {
    const item = items.find((i) => i.id === c.id);
    return s + (item ? item.price * c.qty : 0);
  }, 0);
  const ENVIO_VISIBLE = 1.5;
  const total = subtotal + ENVIO_VISIBLE;

  const bestsellerItems = items.filter((i) => i.bestseller);

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative flex-1 mt-12 bg-white rounded-t-[2rem] overflow-hidden flex flex-col"
        style={{ animation: 'slideUp 0.3s ease-out', maxHeight: '92vh' }}
      >
        {/* Header con portada */}
        <div className="flex-shrink-0">
          {/* Imagen de portada con botón cerrar */}
          <div className={`h-28 relative overflow-hidden ${getSafeImageSrc(local.cover) ? '' : 'bg-gradient-to-r from-rojo-andino to-rojo-andino/80'}`}>
            {getSafeImageSrc(local.cover) ? (
              <>
                <Image src={getSafeImageSrc(local.cover)!} alt={local.name} fill className="object-cover" sizes="100vw" priority unoptimized={local.cover?.startsWith('data:')} />
                <div className="absolute inset-0 bg-black/40" />
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Info del local — siempre sobre fondo blanco */}
          <div className="bg-white px-5 pt-0 pb-4">
            <div className="flex items-end gap-4">
              {/* Logo que sobresale hacia la portada */}
              {local.logo ? (
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-lg flex-shrink-0 bg-white -mt-10">
                  <LocalLogo src={local.logo} alt={local.name} fill className="object-contain" sizes="80px" iconClassName="w-8 h-8 text-rojo-andino" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-dorado-oro border-4 border-white shadow-lg flex-shrink-0 flex items-center justify-center -mt-10">
                  <ShoppingBag className="w-8 h-8 text-white" />
                </div>
              )}
              {/* Nombre e info — completamente en el área blanca */}
              <div className="flex-1 min-w-0 pt-3 pb-1">
                <h2 className="font-bold text-xl text-gray-900 leading-tight">{local.name}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-dorado-oro text-dorado-oro" />
                    <span className="font-semibold text-gray-700">{local.rating}</span>
                    {local.reviews && <span>({local.reviews})</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    {local.time}
                  </span>
                  <span className="flex items-center gap-1 text-rojo-andino font-medium">
                    <Truck className="w-3.5 h-3.5" />
                    Envío $1.50
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sección Más vendidos */}
        {bestsellerItems.length > 0 && (
          <div className="px-5 pt-3 pb-1 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-rojo-andino" />
              <h3 className="font-bold text-gray-900 text-sm">Más vendidos</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
              {bestsellerItems.map((item) => {
                const qty = cart.find((c) => c.id === item.id)?.qty ?? 0;
                return (
                  <ItemCard key={item.id} item={item} qty={qty} onAdd={onAdd} onRemove={onRemove} compact />
                );
              })}
            </div>
          </div>
        )}

        {/* Lista completa del menú */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-3 pb-1">
            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Menú completo</h3>
          </div>
          {items.map((item) => {
            const qty = cart.find((c) => c.id === item.id)?.qty ?? 0;
            return <ItemCard key={item.id} item={item} qty={qty} onAdd={onAdd} onRemove={onRemove} />;
          })}

          {/* Sección de reseñas */}
          {reviewsList && reviewsList.length > 0 && (
            <div className="px-5 pt-5 pb-6">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 fill-dorado-oro text-dorado-oro" />
                <h3 className="font-bold text-gray-900 text-sm">Opiniones</h3>
                <span className="text-xs text-gray-400 ml-1">{local.rating} · {local.reviews} reseñas</span>
              </div>
              <div className="space-y-3">
                {reviewsList.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3">
                    <div className="w-9 h-9 rounded-full bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-rojo-andino text-sm">{r.author[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900 text-sm">{r.author}</p>
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star key={j} className={`w-3 h-3 ${j < r.rating ? 'fill-dorado-oro text-dorado-oro' : 'text-gray-200'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{r.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="h-4" />
        </div>

        {/* Footer con total */}
        {totalItems > 0 && (
          <div className="p-4 bg-white border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
            <div className="flex justify-between text-sm text-gray-500 mb-1.5">
              <span>Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500 mb-3">
              <span>Envío</span>
              <span>$1.50</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base mb-4">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <button
              type="button"
              onClick={onCheckout}
              className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <ShoppingBag className="w-5 h-5" />
              Confirmar pedido · ${total.toFixed(2)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
