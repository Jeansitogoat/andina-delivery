'use client';

import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getDoc, doc } from 'firebase/firestore';
import type { DireccionGuardada } from '@/components/usuario/SeccionDirecciones';
import { useAuth } from '@/lib/useAuth';
import { getFirestoreDb } from '@/lib/firebase/client';
import { saveAddresses, setSelectedAddress } from '@/lib/addressesFirestore';

const STORAGE_KEY = 'andina_direcciones';
const SELECTED_KEY = 'andina_direccion_seleccionada';

/** Sectores/zona de cobertura en Piñas para mostrar "estás lejos" si no coincide */
const ZONA_PINAS = ['Piñas', 'piñas', 'Sector La Cadena', 'Parque Central', 'Av. 9 de Octubre', 'Calle Sucre', 'Av. Rocafuerte', 'Calle Bolívar', 'Los Ceibos', 'La Cadena', 'Santa Ana', 'Montañita', 'El Paraíso', 'Urb. Los Pinos', 'Barrio La Esperanza'];

type AddressesContextType = {
  direcciones: DireccionGuardada[];
  selectedId: string | null;
  setSelectedId: (_id: string | null) => void;
  direccionEntregar: string;
  /** Coordenadas de la dirección de entrega (seleccionada o principal) para cálculo de distancia. */
  direccionEntregarLatLng: { lat: number; lng: number } | null;
  /** Ubicación actual del dispositivo (si el usuario dio permiso). Fallback para distancia si no hay dirección con coords. */
  userLocationLatLng: { lat: number; lng: number } | null;
  /** Vuelve a solicitar GPS (p. ej. tras denegar permiso). maximumAge 0 para lectura fresca. */
  requestUserLocation: (options?: {
    onSuccess?: (_pos: { lat: number; lng: number }) => void;
    onDenied?: () => void;
  }) => void;
  /** Direcciones hidratadas desde Firestore o localStorage; evita UI (p. ej. onboarding) antes de tiempo. */
  addressesReady: boolean;
  addDireccion: (_d: Omit<DireccionGuardada, 'id'>) => void;
  updateDirecciones: (_dirs: DireccionGuardada[]) => void;
  setPrincipal: (_id: string) => void;
  removeDireccion: (_id: string) => void;
  estaLejos: boolean;
  saving?: boolean;
};

const AddressesContext = createContext<AddressesContextType | null>(null);

function loadFromLocalStorage(): DireccionGuardada[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DireccionGuardada[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(dirs: DireccionGuardada[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dirs));
  } catch {
    /* ignore */
  }
}

export function AddressesProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [direcciones, setDirecciones] = useState<DireccionGuardada[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [userLocationLatLng, setUserLocationLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedFromLocalRef = useRef(false);

  /** Una lectura getDoc por carga o tras guardar; evita listener permanente (Opción B). */
  const refetchAddresses = useCallback(() => {
    if (!user?.uid) return;
    const db = getFirestoreDb();
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        const data = snap.data();
        const arr = data?.addresses;
        const sid = data?.selectedAddressId;
        setDirecciones(Array.isArray(arr) ? (arr as DireccionGuardada[]) : []);
        setSelectedIdState(typeof sid === 'string' ? sid : null);
      })
      .catch((err) => console.error('addresses refetch', err));
  }, [user?.uid]);

  /* Carga inicial desde Firestore (getDoc una vez al montar con usuario). */
  useEffect(() => {
    if (!user?.uid) return;
    /* Hasta tener direcciones del usuario en Firestore, no exponer addressesReady (evita onboarding/map antes de la cuenta). */
    setHydrated(false);
    let cancelled = false;
    const db = getFirestoreDb();
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.data();
        const arr = data?.addresses;
        const sid = data?.selectedAddressId;
        setDirecciones(Array.isArray(arr) ? (arr as DireccionGuardada[]) : []);
        setSelectedIdState(typeof sid === 'string' ? sid : null);
      })
      .catch((err) => {
        if (!cancelled) console.error('addresses initial load', err);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [user?.uid]);

  /* Usuario logueado por primera vez: migrar localStorage -> Firestore */
  useEffect(() => {
    if (!user?.uid || syncedFromLocalRef.current) return;
    const local = loadFromLocalStorage();
    let localSelected: string | null = null;
    if (typeof window !== 'undefined') {
      try {
        localSelected = localStorage.getItem(SELECTED_KEY);
      } catch {
        /* Silencioso en móvil (modo privado, WebView, etc.) */
      }
    }
    if (local.length > 0) {
      syncedFromLocalRef.current = true;
      saveAddresses(user.uid, local)
        .then(() => {
          if (localSelected) return setSelectedAddress(user.uid, localSelected);
        })
        .then(() => refetchAddresses())
        .then(() => {
          try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(SELECTED_KEY);
          } catch {
            /* ignore */
          }
        })
        .catch((err) => console.error('addresses sync saveAddresses', err));
    }
  }, [user?.uid, refetchAddresses]);

  /* Sin usuario: usar localStorage */
  useEffect(() => {
    if (user?.uid) return;
    setDirecciones(loadFromLocalStorage());
    if (typeof window !== 'undefined') {
      try {
        const sid = localStorage.getItem(SELECTED_KEY);
        setSelectedIdState(sid);
      } catch {
        /* Silencioso en móvil (modo privado, WebView, etc.) */
      }
    }
    setHydrated(true);
  }, [user?.uid]);

  /* Pedir permiso de ubicación (fallback distancia). No en /auth: coincide con onboarding PWA. */
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator?.geolocation) return;
    if (pathname?.startsWith('/auth')) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (typeof latitude === 'number' && typeof longitude === 'number' && !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
          setUserLocationLatLng({ lat: latitude, lng: longitude });
        }
      },
      () => {},
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: true }
    );
  }, [pathname]);

  const requestUserLocation = useCallback(
    (options?: { onSuccess?: (_pos: { lat: number; lng: number }) => void; onDenied?: () => void }) => {
      if (typeof window === 'undefined' || !navigator?.geolocation) {
        options?.onDenied?.();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (
            typeof latitude === 'number' &&
            typeof longitude === 'number' &&
            !Number.isNaN(latitude) &&
            !Number.isNaN(longitude)
          ) {
            const coords = { lat: latitude, lng: longitude };
            setUserLocationLatLng(coords);
            options?.onSuccess?.(coords);
          } else {
            options?.onDenied?.();
          }
        },
        () => {
          options?.onDenied?.();
        },
        { timeout: 20000, maximumAge: 0, enableHighAccuracy: true }
      );
    },
    []
  );

  const scheduleSaveAddresses = useCallback(
    (dirs: DireccionGuardada[]) => {
      if (!user?.uid) {
        saveToLocalStorage(dirs);
        return;
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      setSaving(true);
      const uid = user.uid;
      saveTimeoutRef.current = setTimeout(() => {
        saveAddresses(uid, dirs)
          .then(() => refetchAddresses())
          .catch((err) => console.error('addresses saveAddresses', err))
          .finally(() => {
            setSaving(false);
            saveTimeoutRef.current = null;
          });
      }, 500);
    },
    [user?.uid, refetchAddresses]
  );

  const setSelectedId = useCallback(
    (id: string | null) => {
      setSelectedIdState(id);
      if (user?.uid) {
        setSelectedAddress(user.uid, id).then(() => refetchAddresses()).catch((err) => console.error('setSelectedAddress', err));
      } else if (typeof window !== 'undefined') {
        try {
          if (id) localStorage.setItem(SELECTED_KEY, id);
          else localStorage.removeItem(SELECTED_KEY);
        } catch {
          /* Silencioso en móvil (modo privado, WebView, etc.) */
        }
      }
    },
    [user?.uid, refetchAddresses]
  );

  const updateDirecciones = useCallback(
    (dirs: DireccionGuardada[]) => {
      setDirecciones(dirs);
      scheduleSaveAddresses(dirs);
    },
    [scheduleSaveAddresses]
  );

  const addDireccion = useCallback(
    (d: Omit<DireccionGuardada, 'id'>) => {
      const id = `dir-${Date.now()}`;
      const nueva: DireccionGuardada = { ...d, id };
      setDirecciones((prev) => {
        const base = d.principal ? prev.map((x) => ({ ...x, principal: false })) : prev;
        const next = [...base, nueva];
        scheduleSaveAddresses(next);
        return next;
      });
      setSelectedId(id);
    },
    [setSelectedId, scheduleSaveAddresses]
  );

  const setPrincipal = useCallback(
    (id: string) => {
      setDirecciones((prev) => {
        const next = prev.map((d) => ({ ...d, principal: d.id === id }));
        scheduleSaveAddresses(next);
        return next;
      });
    },
    [scheduleSaveAddresses]
  );

  const removeDireccion = useCallback(
    (id: string) => {
      setDirecciones((prev) => {
        const next = prev.filter((d) => d.id !== id);
        scheduleSaveAddresses(next);
        return next;
      });
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId, setSelectedId, scheduleSaveAddresses]
  );

  const principal = direcciones.find((d) => d.principal) ?? direcciones[0];
  const seleccionada = selectedId ? direcciones.find((d) => d.id === selectedId) : null;
  const dirEntregar = seleccionada ?? principal;
  const direccionEntregar = dirEntregar?.detalle ?? '';
  const direccionEntregarLatLng: { lat: number; lng: number } | null =
    dirEntregar != null &&
    typeof dirEntregar.lat === 'number' &&
    typeof dirEntregar.lng === 'number' &&
    !Number.isNaN(dirEntregar.lat) &&
    !Number.isNaN(dirEntregar.lng)
      ? { lat: dirEntregar.lat, lng: dirEntregar.lng }
      : null;

  const textoParaZona = (detalle: string) => detalle || '';
  const tieneDireccion = !!(seleccionada ?? principal);
  const estaLejos =
    hydrated &&
    tieneDireccion &&
    !ZONA_PINAS.some((sector) => textoParaZona(direccionEntregar).toLowerCase().includes(sector.toLowerCase()));

  const value: AddressesContextType = {
    direcciones,
    selectedId,
    setSelectedId,
    direccionEntregar,
    direccionEntregarLatLng,
    userLocationLatLng,
    requestUserLocation,
    addDireccion,
    updateDirecciones,
    setPrincipal,
    removeDireccion,
    estaLejos,
    saving,
    addressesReady: hydrated,
  };

  return <AddressesContext.Provider value={value}>{children}</AddressesContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressesContext);
  if (!ctx) throw new Error('useAddresses must be used within AddressesProvider');
  return ctx;
}
