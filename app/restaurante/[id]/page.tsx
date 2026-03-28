'use client';

import { use, useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Star,
  Clock,
  Truck,
  MapPin,
  Flame,
  Plus,
  Minus,
  ShoppingBag,
  Search,
  MessageCircle,
  ExternalLink,
  UtensilsCrossed,
} from 'lucide-react';
import type { MenuItem } from '@/lib/data';
import { useCart } from '@/lib/useCart';
import { useAuth } from '@/lib/useAuth';
import { useLocal } from '@/lib/useLocal';
import { useAddresses } from '@/lib/addressesContext';
import { useTarifasEnvio } from '@/lib/useTarifasEnvio';
import { haversineKm, formatDistanceKm } from '@/lib/geo';
import { formatWhatsAppLink } from '@/lib/utils/phone';
import { useFullScreenModal } from '@/lib/FullScreenModalContext';
import ProductDetailSheet from '@/components/ProductDetailSheet';
import SkeletonRestaurante from '@/components/SkeletonRestaurante';
import LocalLogo from '@/components/LocalLogo';
import { getEstadoAbierto } from '@/lib/abiertoAhora';
import { getSafeImageSrc, shouldBypassImageOptimizer } from '@/lib/validImageUrl';
import { resolveIvaConfig } from '@/lib/order-money';

export default function RestaurantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { cart, addItem, removeItem } = useCart();
  const { local, menu: allItems, reviews, isLoading: loading, error } = useLocal(id);
  const notFound = !!error || (!loading && !local);
  const stopForThisLocal = cart.stops.find((s) => s.localId === id);
  const localCartCount = stopForThisLocal ? stopForThisLocal.items.reduce((s, c) => s + c.qty, 0) : 0;
  const { isOpen: fullScreenModalOpen } = useFullScreenModal();
  const { userLocationLatLng } = useAddresses();
  const { getTarifaEnvioPorDistancia, tarifaMinima } = useTarifasEnvio();

  // Categorías: las del local + las que tengan productos en el menú (ej. "Promociones" creada en el panel)
  const categoriesFromMenu = Array.from(new Set(allItems.map((i) => i.category).filter(Boolean))) as string[];
  const baseCategories = local?.categories ?? [];
  const categories = baseCategories.length
    ? [...baseCategories, ...categoriesFromMenu.filter((c) => !baseCategories.includes(c))]
    : categoriesFromMenu;

  const VER_TODO = 'Ver todo';
  const tabs = [VER_TODO, ...categories];

  const [activeCategory, setActiveCategory] = useState(VER_TODO);
  const [scrollHighlightCategory, setScrollHighlightCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [search, setSearch] = useState('');
  const [pageVisible, setPageVisible] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (categories.length && activeCategory === VER_TODO) return;
    if (categories.length) setActiveCategory((prev) => (prev === VER_TODO || categories.includes(prev) ? prev : categories[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when local/items change to avoid category reset loops
  }, [local?.id, allItems.length]);

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  // Sincronizar tab activo al hacer scroll (solo en modo "Ver todo")
  useEffect(() => {
    if (activeCategory !== VER_TODO) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setScrollHighlightCategory(entry.target.getAttribute('data-category'));
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    );
    Object.entries(sectionRefs.current).forEach(([, el]) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [allItems, activeCategory]);

  const selectTab = (cat: string) => {
    if (cat === VER_TODO) {
      setActiveCategory(VER_TODO);
      setScrollHighlightCategory(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveCategory(cat);
    }
  };

  const filteredItems = (cat: string) => {
    const items = allItems.filter((i) => i.category === cat);
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
  };

  const cartSubtotal = stopForThisLocal ? stopForThisLocal.items.reduce((s, c) => {
    const item = allItems.find((i) => i.id === c.id);
    return s + (item ? item.price * c.qty : 0);
  }, 0) : 0;

  if (loading || !local) {
    if (notFound) {
      return (
        <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
          <p className="text-gray-500 text-lg">Local no encontrado</p>
          <button onClick={() => router.push('/')} className="text-rojo-andino font-semibold underline">
            Volver al inicio
          </button>
        </main>
      );
    }
    return <SkeletonRestaurante />;
  }

  if (!pageVisible) {
    return <SkeletonRestaurante />;
  }

  const estado = getEstadoAbierto(local);
  const cerrado = !estado.abierto;
  const ivaConfig = resolveIvaConfig(local);
  const cartIva = ivaConfig.ivaEnabled ? cartSubtotal * ivaConfig.ivaRate : 0;
  const cartSubtotalCliente = cartSubtotal + cartIva;

  const reviewsSection = reviews.length > 0 ? (
    <section>
      <h2 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
        <Star className="w-5 h-5 fill-dorado-oro text-dorado-oro" />
        Opiniones
        <span className="text-sm font-normal text-gray-400">
          {local.reviews > 0 ? `${local.rating.toFixed(1)} · ${local.reviews} reseñas` : 'Sin opiniones aún'}
        </span>
      </h2>
      <div className="space-y-3">
        {reviews.map((r, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-3">
            <div className="w-10 h-10 rounded-full bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
              <span className="font-black text-rojo-andino text-sm">{r.author[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-gray-900 text-sm">{r.author}</p>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className={`w-3 h-3 ${j < r.rating ? 'fill-dorado-oro text-dorado-oro' : 'text-gray-200 fill-gray-200'}`} />
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  ) : null;

  return (
    <>
      <main className="min-h-screen bg-surface pb-28">
        {/* === COVER + HEADER === */}
        <div className="relative">
          {/* Cover image */}
          <div className="relative w-full h-52 md:h-72 bg-gray-200 overflow-hidden">
            {getSafeImageSrc(local.cover) ? (
              <Image
                src={getSafeImageSrc(local.cover)!}
                alt={local.name}
                fill
                className="object-cover"
                sizes="100vw"
                priority
                unoptimized={shouldBypassImageOptimizer(local.cover)}
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-transparent" />
          </div>

          {/* Back button + Volver al panel */}
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between md:top-4 md:left-4 md:right-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-black/35 hover:bg-black/55 flex items-center justify-center backdrop-blur-md transition-colors"
              aria-label="Volver"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </button>
            {!authLoading && user && user.rol !== 'cliente' && (
              <button
                type="button"
                onClick={() => {
                  if (user.rol === 'central') router.push('/panel/central');
                  else if (user.rol === 'rider') router.push('/panel/rider');
                  else if (user.rol === 'local') router.push((user as { localId?: string }).localId ? `/panel/restaurante/${(user as { localId?: string }).localId}` : '/panel/restaurante');
                  else if (user.rol === 'maestro') router.push('/panel/maestro');
                }}
                className="hidden md:inline-flex py-2 px-3 rounded-xl bg-black/40 hover:bg-black/60 text-white text-sm font-semibold backdrop-blur-md transition-colors"
              >
                Volver al panel
              </button>
            )}
          </div>
        </div>

        {/* === INFO DEL LOCAL === */}
        <section className="bg-white shadow-sm">
          <div className="max-w-3xl mx-auto safe-x pt-0 pb-4">
            <div className="flex items-end gap-4 -mt-10 mb-3">
              {/* Logo */}
              <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-4 border-white shadow-xl flex-shrink-0 bg-white">
                {local.logo ? (
                  <LocalLogo
                    src={local.logo}
                    alt={local.name}
                    fill
                    className="object-contain"
                    sizes="96px"
                    unoptimized={local.logo.startsWith('data:')}
                    iconClassName="w-8 h-8 text-rojo-andino"
                  />
                ) : (
                  <div className="absolute inset-0 bg-rojo-andino/10 flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-rojo-andino" />
                  </div>
                )}
              </div>
              {/* Nombre */}
              <div className="flex-1 min-w-0 pt-10">
                <h1 className="font-black text-xl md:text-2xl text-gray-900 leading-tight">{local.name}</h1>
              </div>
            </div>

            {/* Stats row */}
            {(() => {
              const originLat = userLocationLatLng;
              const kmLocal = originLat && typeof local.lat === 'number' && typeof local.lng === 'number'
                ? haversineKm(originLat.lat, originLat.lng, local.lat, local.lng)
                : null;
              const envioText = kmLocal != null
                ? `$${getTarifaEnvioPorDistancia(kmLocal).toFixed(2)}`
                : `Desde $${tarifaMinima.toFixed(2)}`;
              return (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
                  <span className="flex items-center gap-1 font-semibold text-gray-800">
                    <Star className="w-4 h-4 fill-dorado-oro text-dorado-oro" />
                    {local.reviews > 0 ? local.rating.toFixed(1) : 'Nuevo'}
                    <span className="font-normal text-gray-500">
                      {local.reviews > 0 ? `(${local.reviews} opiniones)` : '(Sin opiniones aún)'}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {local.time}
                  </span>
                  <span className="flex items-center gap-1 text-rojo-andino font-semibold">
                    <Truck className="w-4 h-4" />
                    Envío {envioText}
                  </span>
                </div>
              );
            })()}

            {local.address && (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <MapPin className="w-3.5 h-3.5" />
                    {local.address}
                  </div>
                  {userLocationLatLng && typeof local.lat === 'number' && typeof local.lng === 'number' && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${local.lat},${local.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-semibold text-rojo-andino hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      ¿Cómo llegar?
                    </a>
                  )}
                </div>
                {userLocationLatLng && typeof local.lat === 'number' && typeof local.lng === 'number' && (
                  <p className="text-xs text-gray-500">
                    A {formatDistanceKm(haversineKm(userLocationLatLng.lat, userLocationLatLng.lng, local.lat, local.lng))} de ti
                  </p>
                )}
              </div>
            )}
            {local.telefono?.trim() && (() => {
              const waHref = formatWhatsAppLink(local.telefono);
              return waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-green-600 hover:text-green-700"
                >
                  <MessageCircle className="w-4 h-4" />
                  Contactar por WhatsApp
                </a>
              ) : null;
            })()}

            {/* Aviso de disponibilidad */}
            {cerrado && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="font-semibold text-amber-900 text-sm">{estado.mensaje}</p>
                {estado.abreA && (
                  <p className="text-amber-800 text-xs mt-1">{estado.abreA}</p>
                )}
              </div>
            )}
            {estado.abierto && estado.cierraA && (
              <p className="mt-2 text-xs text-gray-500">{estado.cierraA}</p>
            )}
            {ivaConfig.ivaEnabled && (
              <p className="mt-2 text-xs font-medium text-gray-500">
                Precios base del local. Al pagar se suma IVA ({(ivaConfig.ivaRate * 100).toFixed(0)}%).
              </p>
            )}

          {allItems.length === 0 && (
            <div className="max-w-3xl mx-auto safe-x py-8">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex flex-col items-center justify-center text-center">
                <UtensilsCrossed className="w-14 h-14 text-gray-300 mb-4" />
                <p className="text-gray-600 font-medium">Este negocio cargará su menú pronto</p>
              </div>
            </div>
          )}
          {allItems.length > 0 && (
            <>
              <div className="max-w-3xl mx-auto safe-x pb-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar productos..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-mobile w-full !pl-10 pr-4 text-sm bg-gray-50"
                  />
                </div>
              </div>
              <div
                ref={tabsRef}
                className="flex gap-0 overflow-x-auto scrollbar-hide border-t border-gray-100 sticky top-0 bg-white z-10 shadow-sm"
              >
                {tabs.map((cat) => {
                  const isActive = activeCategory === VER_TODO
                    ? (cat === VER_TODO ? !scrollHighlightCategory : scrollHighlightCategory === cat)
                    : activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      data-tab={cat}
                      type="button"
                      onClick={() => selectTab(cat)}
                      className={`flex-shrink-0 px-4 py-3.5 text-sm font-semibold transition-all relative whitespace-nowrap ${
                        isActive ? 'text-rojo-andino' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {cat}
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-rojo-andino rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="max-w-3xl mx-auto safe-x py-4 space-y-6">
                {activeCategory === VER_TODO ? (
                  categories.map((cat) => {
                    const items = filteredItems(cat);
                    if (items.length === 0) return null;
                    return (
                      <section
                        key={cat}
                        data-category={cat}
                        ref={(el) => { sectionRefs.current[cat] = el; }}
                      >
                        <h2 className="font-bold text-lg text-gray-900 mb-3">{cat}</h2>
                        <div className="space-y-0 bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                          {items.map((item, idx) => {
                            const inCart = stopForThisLocal
                              ? (stopForThisLocal.items.find((c) => c.id === item.id)?.qty ?? 0)
                              : 0;
                            return (
                              <ProductRow
                                key={item.id}
                                item={item}
                                displayPrice={ivaConfig.ivaEnabled ? item.price * (1 + ivaConfig.ivaRate) : item.price}
                                inCart={inCart}
                                isLast={idx === items.length - 1}
                                cerrado={cerrado}
                                onOpen={() => setSelectedItem(item)}
                                onAdd={() => addItem(id, item.id)}
                                onRemove={() => removeItem(item.id)}
                              />
                            );
                          })}
                        </div>
                      </section>
                    );
                  })
                ) : (
                  (() => {
                    const items = filteredItems(activeCategory);
                    if (items.length === 0) {
                      return (
                        <p className="text-gray-500 text-center py-8">No hay productos en esta categoría.</p>
                      );
                    }
                    return (
                      <section>
                        <h2 className="font-bold text-lg text-gray-900 mb-3">{activeCategory}</h2>
                        <div className="space-y-0 bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                          {items.map((item, idx) => {
                            const inCart = stopForThisLocal
                              ? (stopForThisLocal.items.find((c) => c.id === item.id)?.qty ?? 0)
                              : 0;
                            return (
                              <ProductRow
                                key={item.id}
                                item={item}
                                displayPrice={ivaConfig.ivaEnabled ? item.price * (1 + ivaConfig.ivaRate) : item.price}
                                inCart={inCart}
                                isLast={idx === items.length - 1}
                                cerrado={cerrado}
                                onOpen={() => setSelectedItem(item)}
                                onAdd={() => addItem(id, item.id)}
                                onRemove={() => removeItem(item.id)}
                              />
                            );
                          })}
                        </div>
                      </section>
                    );
                  })()
                )}
                      </div>
                </>
          )}

          {reviewsSection}
          </div>
        </section>
      </main>

      {/* === BARRA FLOTANTE CARRITO (oculta cuando modal Nueva ubicación está abierto) === */}
      {localCartCount > 0 && !fullScreenModalOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent"
          style={{ animation: 'slideUp 0.3s ease-out' }}
        >
          <div className="max-w-3xl mx-auto">
            <button
              type="button"
              onClick={() => router.push('/carrito')}
              className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold text-base flex items-center gap-3 px-5 shadow-2xl transition-all active:scale-[0.98]"
            >
              <span className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center text-sm font-black flex-shrink-0">
                {localCartCount}
              </span>
              <span className="flex-1 text-left">Ver mi pedido</span>
              <span className="font-bold">${cartSubtotalCliente.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {/* === PRODUCT DETAIL SHEET === */}
      <ProductDetailSheet
        item={selectedItem}
        localId={id}
        cerrado={cerrado}
        cerradoMensaje={cerrado ? estado.mensaje : undefined}
        cerradoAbreA={cerrado ? estado.abreA : undefined}
        currentQty={
          selectedItem && stopForThisLocal
            ? (stopForThisLocal.items.find((c) => c.id === selectedItem.id)?.qty ?? 0)
            : 0
        }
        onClose={() => setSelectedItem(null)}
        onAdd={addItem}
        onRemove={removeItem}
      />
    </>
  );
}

// ---- Fila de producto en el menú ----
function ProductRow({
  item,
  displayPrice,
  inCart,
  isLast,
  cerrado,
  onOpen,
  onAdd,
  onRemove,
}: {
  item: MenuItem;
  displayPrice: number;
  inCart: number;
  isLast: boolean;
  cerrado?: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-gray-50/80 transition-colors ${
        !isLast ? 'border-b border-gray-50' : ''
      }`}
      onClick={onOpen}
    >
      {/* Texto */}
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
        <p className="font-bold text-gray-900 text-sm mt-1.5">${displayPrice.toFixed(2)}</p>
      </div>

      {/* Imagen + controles */}
      <div className="relative flex-shrink-0">
        <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
          {getSafeImageSrc(item.image) ? (
            <Image
              src={getSafeImageSrc(item.image)!}
              alt={item.name}
              fill
              className="object-cover"
              sizes="96px"
              unoptimized={shouldBypassImageOptimizer(item.image)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-gray-300" />
            </div>
          )}
        </div>
        {/* Controles de cantidad */}
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
                onClick={(e) => { e.stopPropagation(); if (!cerrado) onAdd(); }}
                disabled={cerrado}
                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors active:scale-90 ${cerrado ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-rojo-andino text-white hover:bg-rojo-andino/90'}`}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (!cerrado) onOpen(); }}
              disabled={cerrado}
              className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-90 ${cerrado ? 'bg-gray-200 text-gray-400 cursor-not-allowed hover:scale-100' : 'bg-rojo-andino text-white hover:bg-rojo-andino/90 hover:scale-110'}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
