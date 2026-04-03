'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  UtensilsCrossed,
  ShoppingBag,
  Pill,
  Package,
  Coffee,
  Fish,
  IceCreamCone,
  Flame,
  Pizza,
  Soup,
  Sandwich,
  Drumstick,
  Vegan,
  MapPin,
  Star,
  Clock,
  Truck,
  Phone,
  User,
  Store,
  RefreshCw,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import AddressSelector from '@/components/AddressSelector';
import SkeletonLocales from '@/components/SkeletonLocales';
import LocalLogo from '@/components/LocalLogo';
import { useCart } from '@/lib/useCart';
import { useAuth } from '@/lib/useAuth';
import { useAndinaConfig } from '@/lib/AndinaContext';
import { useAddresses } from '@/lib/addressesContext';
import { useFullScreenModal } from '@/lib/FullScreenModalContext';
import { getIdToken } from '@/lib/authToken';
import { getEstadoAbierto } from '@/lib/abiertoAhora';
import { haversineKm, formatDistanceKm } from '@/lib/geo';
import { useTarifasEnvio } from '@/lib/useTarifasEnvio';
import { usePublicConfig } from '@/lib/PublicConfigContext';
import { getSafeImageSrc, shouldBypassImageOptimizer } from '@/lib/validImageUrl';
import {
  DISCOVERY_CATEGORIES,
  type DiscoveryCategoryKey,
  isDiscoveryCategoryKey,
  mapLegacyTypeToDiscoveryCategory,
} from '@/lib/discovery-categorias';

type CategoryKey = 'all' | DiscoveryCategoryKey;

const categoryIcons: Record<DiscoveryCategoryKey, LucideIcon> = {
  cafes: Coffee,
  marisquerias: Fish,
  heladerias_postres: IceCreamCone,
  comida_rapida: Sandwich,
  parrillas: Flame,
  pizzas: Pizza,
  pastas: Soup,
  sushi: Fish,
  mexicana: Drumstick,
  china: Vegan,
  market: ShoppingBag,
  farmacias: Pill,
};

const categories = DISCOVERY_CATEGORIES.map((cat) => ({
  key: cat.key,
  name: cat.label,
  icon: categoryIcons[cat.key] ?? UtensilsCrossed,
}));

const CATEGORY_CHIPS_VISIBLE_LIMIT = 6;

function getDiscoveryKeysFromLocales(
  locales: Array<{ categorias?: string[]; type: string[] }>
): DiscoveryCategoryKey[] {
  const keys = new Set<DiscoveryCategoryKey>();
  for (const loc of locales) {
    const source = Array.isArray(loc.categorias) && loc.categorias.length > 0 ? loc.categorias : loc.type;
    for (const raw of source) {
      if (isDiscoveryCategoryKey(raw)) {
        keys.add(raw);
        continue;
      }
      const mapped = mapLegacyTypeToDiscoveryCategory(raw);
      if (mapped) keys.add(mapped);
    }
  }
  return [...keys];
}


export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { cartCount, localId: cartLocalId } = useCart();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryKey>('all');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [seguimientoOrderId, setSeguimientoOrderId] = useState<string | null>(null);
  const [bannerErrors, setBannerErrors] = useState<Set<string>>(() => new Set());
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [availableCategoryKeys, setAvailableCategoryKeys] = useState<Set<DiscoveryCategoryKey>>(
    () => new Set()
  );
  const [allLocalesCategorySource, setAllLocalesCategorySource] = useState<
    Array<{ categorias?: string[]; type: string[] }>
  >([]);
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const {
    localesLight: localesList,
    loading: loadingLocales,
    error: configError,
    refreshConfig,
    setLocalesCategoryFilter,
  } = useAndinaConfig();
  const { direccionEntregarLatLng, userLocationLatLng } = useAddresses();
  const { getTarifaEnvioPorDistancia, tarifaMinima } = useTarifasEnvio();
  const { isOpen: fullScreenModalOpen } = useFullScreenModal();
  const originLatLng = direccionEntregarLatLng ?? userLocationLatLng;
  const usuarioLogueado = !!user;

  useEffect(() => {
    setLocalesCategoryFilter(category === 'all' ? null : category);
  }, [category, setLocalesCategoryFilter]);

  useEffect(() => {
    if (category === 'all' && localesList.length > 0) {
      const normalized = localesList.map((loc) => ({
        categorias: Array.isArray(loc.categorias) ? loc.categorias : [],
        type: Array.isArray(loc.type) ? loc.type : [],
      }));
      setAllLocalesCategorySource(normalized);
      setAvailableCategoryKeys(new Set(getDiscoveryKeysFromLocales(normalized)));
    }
  }, [category, localesList]);

  useEffect(() => {
    if (allLocalesCategorySource.length === 0) return;
    setAvailableCategoryKeys(new Set(getDiscoveryKeysFromLocales(allLocalesCategorySource)));
  }, [allLocalesCategorySource]);

  const sortedVisibleCategories = useMemo(() => {
    return categories
      .filter((cat) => availableCategoryKeys.has(cat.key))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [availableCategoryKeys]);

  useEffect(() => {
    if (category === 'all') return;
    const visibleWhenCollapsed = sortedVisibleCategories.slice(0, CATEGORY_CHIPS_VISIBLE_LIMIT);
    const selectedVisible = visibleWhenCollapsed.some((c) => c.key === category);
    if (!selectedVisible) setShowAllCategories(true);
  }, [category, sortedVisibleCategories]);

  const categoryChips = showAllCategories
    ? sortedVisibleCategories
    : sortedVisibleCategories.slice(0, CATEGORY_CHIPS_VISIBLE_LIMIT);

  useEffect(() => {
    const target = categoryButtonRefs.current[category];
    if (!target) return;
    target.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [category, showAllCategories]);

  // Primera visita → /auth: lo gestiona AuthSplashGate (evita flash de locales antes del login).

  // Redirigir local y maestro a su panel (rider y central pueden quedarse para pedir)
  useEffect(() => {
    if (typeof window === 'undefined' || authLoading || !user) return;
    if (user.rol === 'cliente' || user.rol === 'rider' || user.rol === 'central') return;
    switch (user.rol) {
      case 'local':
        router.replace(user.localId ? `/panel/restaurante/${user.localId}` : '/panel/restaurante');
        return;
      case 'maestro':
        router.replace('/panel/maestro');
        return;
      default:
        break;
    }
  }, [authLoading, user, router]);

  const { banners, intervalSeconds: carruselIntervalSeconds } = usePublicConfig();

  useEffect(() => {
    if (banners.length === 0) return;
    const ms = carruselIntervalSeconds * 1000;
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, ms);
    return () => clearInterval(timer);
  }, [banners.length, carruselIntervalSeconds]);

  // Botón flotante "Ver seguimiento del pedido": solo para clientes con pedido activo (no entregado)
  const fetchSeguimientoOrderId = useCallback(() => {
    if (typeof window === 'undefined' || user?.rol !== 'cliente' || !user?.uid) return;
    getIdToken()
      .then((token) => {
        if (!token) return null;
        return fetch('/api/pedidos/mi-activo', {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((res) => (res && res.ok ? res.json() : null))
      .then((data: { id?: string | null } | null) => {
        if (!data) return;
        setSeguimientoOrderId(data.id && data.id.trim() ? data.id : null);
      })
      .catch(() => setSeguimientoOrderId(null));
  }, [user?.rol, user?.uid]);

  useEffect(() => {
    if (authLoading || typeof window === 'undefined' || user?.rol !== 'cliente') {
      setSeguimientoOrderId(null);
      return;
    }
    if (!user?.uid) return;
    let cancelled = false;
    const doFetch = () => {
      getIdToken()
        .then((token) => {
          if (!token || cancelled) return null;
          return fetch('/api/pedidos/mi-activo', {
            headers: { Authorization: `Bearer ${token}` },
          });
        })
        .then((res) => (res && res.ok ? res.json() : null))
        .then((data: { id?: string | null } | null) => {
          if (cancelled || !data) return;
          setSeguimientoOrderId(data.id && String(data.id).trim() ? data.id : null);
        })
        .catch(() => {
          if (!cancelled) setSeguimientoOrderId(null);
        });
    };
    doFetch();
    const onFocus = () => fetchSeguimientoOrderId();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchSeguimientoOrderId();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authLoading, user?.rol, user?.uid, fetchSeguimientoOrderId]);

  const filteredLocales = useMemo(() => {
    let list = localesList.filter((l) => l.status !== 'suspended');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) => {
        const types = l.categorias?.length
          ? l.categorias
          : (l.type ?? [])
              .map((t) => t.toLowerCase())
              .map((t) => {
                if (t === 'cafes') return 'cafes';
                if (t === 'market') return 'market';
                if (t === 'farmacias') return 'farmacias';
                return '';
              })
              .filter(Boolean);
        return (
          l.name.toLowerCase().includes(q) ||
          types.some((t) => t.toLowerCase().includes(q)) ||
          (q.includes('cafe') && types.includes('cafes')) ||
          (q.includes('farmacia') && types.includes('farmacias')) ||
          ((q.includes('super') || q.includes('market')) && types.includes('market'))
        );
      });
    }
    // Filtro por categoría discovery: lo aplica el backend (GET /api/locales?categoria=…).

    // Garantía UX: primero solo "abiertos" (orden por distancia), luego "cerrados".
    const abiertos: typeof list = [];
    const cerrados: typeof list = [];
    for (const l of list) {
      const ea = getEstadoAbierto(l);
      (ea.abierto ? abiertos : cerrados).push(l);
    }

    const sortByFeaturedDistanceName = (a: (typeof list)[number], b: (typeof list)[number]) => {
      const aFeat = Boolean((a as { isFeatured?: boolean }).isFeatured);
      const bFeat = Boolean((b as { isFeatured?: boolean }).isFeatured);
      if (aFeat !== bFeat) return aFeat ? -1 : 1;

      if (originLatLng) {
        const hasA = typeof a.lat === 'number' && typeof a.lng === 'number';
        const hasB = typeof b.lat === 'number' && typeof b.lng === 'number';
        if (hasA && hasB) {
          const distA = haversineKm(originLatLng.lat, originLatLng.lng, a.lat!, a.lng!);
          const distB = haversineKm(originLatLng.lat, originLatLng.lng, b.lat!, b.lng!);
          if (distA !== distB) return distA - distB;
        } else if (hasA !== hasB) {
          return hasA ? -1 : 1;
        }
      }

      return a.name.localeCompare(b.name, 'es');
    };

    const abiertosSorted = [...abiertos].sort(sortByFeaturedDistanceName);
    const cerradosSorted = [...cerrados].sort(sortByFeaturedDistanceName);
    return [...abiertosSorted, ...cerradosSorted];
  }, [search, localesList, originLatLng]);

  const activeLocal = cartLocalId ? localesList.find((l) => l.id === cartLocalId) : null;

  return (
    <main className="flex-1 flex flex-col bg-surface">
      {/* Header */}
      <header className="bg-gradient-to-br from-rojo-andino via-red-700 to-rojo-andino text-white sticky top-0 z-30 shadow-softlg w-full">
        <div className="max-w-7xl mx-auto safe-x py-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex flex-col gap-0.5">
              <span className="bg-dorado-oro text-gray-900 font-black text-xl tracking-tight px-3 py-1.5 rounded-xl inline-block w-fit">
                Andina
              </span>
              <span className="text-white/70 text-xs font-medium">Delivery · Piñas, El Oro</span>
            </div>
            <div className="flex items-center gap-2 min-h-[40px]">
              <span className="text-white/90 text-sm font-medium hidden sm:inline">Piñas, El Oro</span>
              {authLoading ? (
                <div className="flex items-center gap-2 py-2 pl-3 pr-4 rounded-xl bg-white/10 animate-pulse min-w-[120px] h-10" aria-hidden />
              ) : (
                <>
                  {usuarioLogueado && user && user.rol === 'rider' && (
                    <button
                      type="button"
                      onClick={() => router.push('/panel/rider')}
                      className="flex items-center gap-2 py-2 px-3 rounded-xl bg-amber-300 hover:bg-amber-200 text-gray-900 text-sm font-black transition-colors shadow-md border border-amber-100"
                    >
                      🛵 Modo Trabajo
                    </button>
                  )}
                  {usuarioLogueado && user && user.rol !== 'cliente' && user.rol !== 'rider' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (user.rol === 'central') router.push('/panel/central');
                        else if (user.rol === 'local') router.push(user.localId ? `/panel/restaurante/${user.localId}` : '/panel/restaurante');
                        else if (user.rol === 'maestro') router.push('/panel/maestro');
                      }}
                      className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition-colors"
                    >
                      Volver al panel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push('/perfil')}
                    className="flex items-center gap-2 py-2 pl-3 pr-4 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
                    aria-label="Perfil"
                  >
                    <div className="w-8 h-8 rounded-full bg-dorado-oro/80 flex items-center justify-center text-gray-900">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="text-white font-semibold text-sm">Perfil</span>
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="¿Qué se te antoja en Piñas?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-mobile w-full !pl-12 pr-4 rounded-3xl shadow-softlg border-white/40"
            />
          </div>
          <div className="mt-2">
            <AddressSelector compact="icon_only" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col safe-x pb-10">
        {/* Categorías */}
        <section className="py-3 sm:py-4 -mt-1 bg-white rounded-t-[2rem] shadow-soft border-t border-gray-100">
          <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-px-1">
            <button
              ref={(el) => {
                categoryButtonRefs.current.all = el;
              }}
              onClick={() => setCategory('all')}
              className={`snap-start flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-3xl transition-all duration-200 min-w-[82px] sm:min-w-[96px] h-[72px] sm:h-[88px] ${
                category === 'all'
                  ? 'bg-rojo-andino text-white shadow-md scale-[1.02]'
                  : 'bg-gray-100 hover:bg-rojo-andino/10 text-gray-700 hover:text-rojo-andino'
              }`}
            >
              <span className="text-xs sm:text-sm font-semibold leading-tight">Todos</span>
            </button>
            <button
              onClick={() => router.push('/express')}
              className="snap-start flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-3xl transition-all min-w-[104px] sm:min-w-[120px] h-[72px] sm:h-[88px] shadow-lg border-2 font-semibold bg-gradient-to-br from-dorado-oro to-amber-500 border-dorado-oro/50 text-gray-900 hover:from-amber-500 hover:to-dorado-oro hover:shadow-xl active:scale-95"
            >
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/30 flex items-center justify-center">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-rojo-andino" />
              </div>
              <span className="text-xs sm:text-sm font-bold leading-tight">Mandados</span>
            </button>
            {categoryChips.map((cat) => (
              <button
                key={cat.key}
                ref={(el) => {
                  categoryButtonRefs.current[cat.key] = el;
                }}
                onClick={() => setCategory(cat.key)}
                className={`snap-start flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-3xl transition-all duration-200 min-w-[82px] sm:min-w-[96px] h-[72px] sm:h-[88px] ${
                  category === cat.key
                    ? 'bg-rojo-andino text-white shadow-md scale-[1.02]'
                    : 'bg-gray-100 hover:bg-rojo-andino/10 text-gray-700 hover:text-rojo-andino'
                }`}
              >
                <div
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center ${
                    category === cat.key ? 'bg-white/20' : 'bg-rojo-andino/10'
                  }`}
                >
                  <cat.icon
                    className={`w-5 h-5 sm:w-6 sm:h-6 ${category === cat.key ? 'text-white' : 'text-rojo-andino'}`}
                  />
                </div>
                <span className="text-[11px] sm:text-sm font-medium leading-tight text-center max-w-[90px] sm:max-w-[104px]">
                  {cat.name}
                </span>
              </button>
            ))}
            {sortedVisibleCategories.length > CATEGORY_CHIPS_VISIBLE_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllCategories((v) => !v)}
                className="snap-start flex-shrink-0 flex items-center justify-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-3xl min-w-[98px] sm:min-w-[110px] h-[72px] sm:h-[88px] bg-gray-100 hover:bg-rojo-andino/10 text-gray-700 hover:text-rojo-andino font-semibold text-xs sm:text-sm transition-colors"
              >
                {showAllCategories ? 'Ver menos' : 'Ver más'}
              </button>
            )}
          </div>
        </section>

        {/* Carrusel de banners */}
        {banners.length > 0 && (
        <div
          className="relative isolate w-full overflow-hidden rounded-2xl my-4 shadow-md"
          style={{ aspectRatio: '3/1' }}
        >
          {banners.map((banner, i) => {
            const safeImageUrl = getSafeImageSrc(banner.imageUrl);
            const showFallback = !safeImageUrl || bannerErrors.has(banner.id);
            return (
            <button
              key={banner.id}
              type="button"
              onClick={() => {
                if (banner.linkType === 'category') setCategory(banner.linkValue as CategoryKey);
                else if (banner.linkType === 'route') router.push(banner.linkValue);
                else if (banner.linkType === 'url') window.open(banner.linkValue, '_blank');
              }}
              className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${
                i === bannerIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {showFallback ? (
                <div className="absolute inset-0 bg-gray-200 flex items-center justify-center" aria-hidden>
                  <Store className="w-12 h-12 text-gray-400" />
                </div>
              ) : (
                <Image
                  src={safeImageUrl!}
                  alt={banner.alt}
                  fill
                  className="object-cover"
                  sizes="100vw"
                  priority={i === 0}
                  unoptimized={shouldBypassImageOptimizer(banner.imageUrl)}
                  onError={() => setBannerErrors((prev) => new Set(prev).add(banner.id))}
                />
              )}
            </button>
          ); })}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-[1]">
            {banners.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setBannerIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === bannerIndex ? 'bg-white w-5' : 'bg-white/50'
                }`}
                aria-label={`Banner ${i + 1}`}
              />
            ))}
          </div>
        </div>
        )}

        {/* Lista de locales */}
        <section>
          {configError && localesList.length > 0 && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-amber-100 px-4 py-3 text-amber-900">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">Sin conexión – Mostrando datos guardados</span>
              </div>
              <button
                type="button"
                onClick={() => refreshConfig()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-200/80 px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar
              </button>
            </div>
          )}
          <h2 className="text-lg font-bold text-gray-900 mb-1">Locales cerca de ti</h2>
          <p className="text-sm text-gray-500 mb-4">
            {originLatLng
              ? 'Entregas cerca de tu ubicación · Ordenado por distancia'
              : 'Selecciona tu ubicación o permite acceso a tu ubicación para ver locales cercanos'}
          </p>
          {(loadingLocales && localesList.length === 0) || navigatingTo ? (
            <SkeletonLocales />
          ) : filteredLocales.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay resultados para &quot;{search}&quot;</p>
              <p className="text-sm mt-1">Prueba con otra búsqueda o categoría</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
              {filteredLocales.map((local, index) => {
                const estado = getEstadoAbierto(local);
                const cerrado = !estado.abierto;
                const badgeText = estado.motivo === 'ocupado' ? 'Ocupado' : 'Cerrado';
                const distanceText =
                  originLatLng && typeof local.lat === 'number' && typeof local.lng === 'number'
                    ? formatDistanceKm(haversineKm(originLatLng.lat, originLatLng.lng, local.lat, local.lng))
                    : '—';
                const kmLocal = originLatLng && typeof local.lat === 'number' && typeof local.lng === 'number'
                  ? haversineKm(originLatLng.lat, originLatLng.lng, local.lat, local.lng)
                  : null;
                const envioText = kmLocal != null
                  ? `$${getTarifaEnvioPorDistancia(kmLocal).toFixed(2)}`
                  : `Desde $${tarifaMinima.toFixed(2)}`;
                return (
                <Link
                  key={local.id}
                  href={`/restaurante/${local.id}`}
                  prefetch={true}
                  className="min-w-0 flex flex-col bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 cursor-pointer group hover:-translate-y-1 relative"
                  onClick={() => setNavigatingTo(local.id)}
                >
                  <div className="relative aspect-[3/2] bg-gray-100 flex items-center justify-center overflow-hidden">
                    {(() => {
                      const safeLogo = getSafeImageSrc(local.logoUrl);
                      return safeLogo ? (
                        <LocalLogo
                          src={safeLogo}
                          alt={local.name}
                          fill
                          className={`object-contain group-hover:scale-105 transition-transform duration-300 transition-opacity duration-300 ${cerrado ? 'opacity-60' : ''}`}
                          sizes="(max-width: 768px) 50vw, 200px"
                          unoptimized={safeLogo.startsWith('data:')}
                          iconClassName={`w-12 h-12 text-rojo-andino/40 transition-opacity duration-300 ${cerrado ? 'opacity-60' : ''}`}
                          priority={index < 4}
                        />
                      ) : (
                        <UtensilsCrossed className={`w-12 h-12 text-rojo-andino/40 group-hover:scale-110 transition-transform transition-opacity duration-300 ${cerrado ? 'opacity-60' : ''}`} />
                      );
                    })()}
                    {cerrado && (
                      <>
                        <div className="absolute inset-0 bg-gray-900/40 z-[1] transition-opacity duration-300" aria-hidden />
                        <span className="absolute inset-0 z-[2] flex items-center justify-center transition-opacity duration-300">
                          <span className="bg-gray-800 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-lg">
                            {badgeText}
                          </span>
                        </span>
                      </>
                    )}
                    {Boolean((local as { isFeatured?: boolean }).isFeatured) && !cerrado && (
                      <span className="absolute top-2 left-2 bg-dorado-oro text-gray-900 text-xs font-bold px-2 py-1 rounded-lg z-[1]">
                        Destacada
                      </span>
                    )}
                    <span className={`absolute bottom-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded-xl backdrop-blur-sm z-[1] ${cerrado ? 'opacity-90' : ''}`}>
                      {local.time}
                    </span>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <h3 className="font-bold text-gray-900 text-sm truncate">{local.name}</h3>
                    <p className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <Star className="w-3.5 h-3.5 fill-dorado-oro text-dorado-oro" />
                      <span className="font-semibold text-gray-700">{local.rating}</span>
                      <span>· {local.type.join(', ')}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500" title="Distancia">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {originLatLng && typeof local.lat === 'number' && typeof local.lng === 'number' ? `A ${distanceText} de ti` : distanceText}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {local.time}
                      </span>
                      <span className="inline-flex items-center gap-1 text-rojo-andino font-medium">
                        <Truck className="w-3.5 h-3.5" />
                        {envioText}
                      </span>
                    </div>
                  </div>
                </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Barra flotante inferior: Ver seguimiento (si pedido activo) y Ver carrito (si hay items) */}
        {(seguimientoOrderId && usuarioLogueado) || (cartCount > 0 && activeLocal && !fullScreenModalOpen) ? (
          <div className="fixed bottom-4 left-4 right-4 z-50 max-w-lg mx-auto flex flex-col gap-3">
            {seguimientoOrderId && usuarioLogueado && (
              <Link
                href={`/pedido/${seguimientoOrderId}`}
                prefetch
                className="w-full py-4 rounded-3xl bg-dorado-oro hover:bg-dorado-oro/90 text-gray-900 font-bold shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] block"
              >
                <Package className="w-5 h-5" />
                Ver seguimiento del pedido
              </Link>
            )}
            {cartCount > 0 && activeLocal && !fullScreenModalOpen && (
              <Link
                href="/carrito"
                prefetch
                className="w-full py-4 rounded-3xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] block"
              >
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-black">
                  {cartCount}
                </div>
                <ShoppingBag className="w-5 h-5" />
                {cartCount} Ver carrito
              </Link>
            )}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <footer className="bg-rojo-andino text-white pt-10 pb-8 sm:pb-6 px-4 w-full">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 sm:gap-6 pb-8 border-b border-white/20">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-white text-rojo-andino font-bold text-base px-2.5 py-1 rounded-lg shadow-sm">
                  ANDINA
                </span>
                <span className="font-semibold text-base">Express</span>
              </div>
              <ul className="space-y-3 text-sm text-white/85">
                <li>
                  <Link
                    href="/socios"
                    className="inline-block py-1 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
                  >
                    ¿Tienes un negocio? Únete a Andina
                  </Link>
                </li>
                <li>
                  <Link
                    href="/sobre"
                    className="inline-block py-1 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
                  >
                    Sobre Andina
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terminos"
                    className="inline-block py-1 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
                  >
                    Términos y Condiciones
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacidad"
                    className="inline-block py-1 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
                  >
                    Privacidad
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-white/70 mb-4">
                Top categorías
              </h3>
              <ul className="space-y-3 text-sm text-white/85">
                {sortedVisibleCategories.slice(0, 4).map((cat) => (
                  <li key={cat.key}>
                    <button type="button" onClick={() => setCategory(cat.key)} className="hover:text-white transition-colors text-left py-1">
                      {cat.name}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => router.push('/express')}
                    className="hover:text-white transition-colors text-left py-1"
                  >
                    Mandados
                  </button>
                </li>
              </ul>
            </div>
            <div className="sm:col-span-2 md:col-span-1">
              <h3 className="font-bold text-xs uppercase tracking-wider text-white/70 mb-4">
                Servicio logístico
              </h3>
              <div className="flex items-start gap-2 text-sm text-white/85 mb-3">
                <MapPin className="w-4 h-4 text-white/90 mt-0.5 flex-shrink-0" />
                <span>Por Socio de la Compañía Virgen de la Merced</span>
              </div>
              <a
                href="tel:+593992250333"
                className="inline-flex items-center gap-2 text-sm text-white font-semibold hover:text-white/90 transition-colors py-1"
              >
                <Phone className="w-4 h-4" />
                099 225 0333
              </a>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/60 text-center sm:text-left order-2 sm:order-1">Andina © 2026 · Piñas, El Oro, Ecuador</p>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 order-1 sm:order-2 w-full sm:w-auto">
              <Link
                href="/socios"
                className="inline-flex items-center justify-center gap-2 text-sm font-bold bg-white text-rojo-andino hover:bg-gray-100 active:scale-[0.98] px-5 py-3 rounded-2xl transition-all shadow-lg min-h-[44px]"
              >
                <Store className="w-5 h-5 flex-shrink-0" />
                ¿Tienes un negocio? Únete a Andina
              </Link>
              <button
                type="button"
                onClick={() => router.push('/panel/restaurante')}
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white border-2 border-white/50 hover:bg-white/10 hover:border-white/70 px-5 py-3 rounded-2xl transition-colors min-h-[44px]"
              >
                <ShoppingBag className="w-5 h-5 flex-shrink-0" />
                Ya tengo panel
              </button>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}
