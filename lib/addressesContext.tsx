'use client';

import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
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
  setSelectedId: (id: string | null) => void;
  direccionEntregar: string;
  /** Coordenadas de la dirección de entrega (seleccionada o principal) para cálculo de distancia. */
  direccionEntregarLatLng: { lat: number; lng: number } | null;
  /** Ubicación actual del dispositivo (si el usuario dio permiso). Fallback para distancia si no hay dirección con coords. */
  userLocationLatLng: { lat: number; lng: number } | null;
  addDireccion: (d: Omit<DireccionGuardada, 'id'>) => void;
  updateDirecciones: (dirs: DireccionGuardada[]) => void;
  setPrincipal: (id: string) => void;
  removeDireccion: (id: string) => void;
  estaLejos: boolean;
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
  } catch (_) {}
}

export function AddressesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [direcciones, setDirecciones] = useState<DireccionGuardada[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [userLocationLatLng, setUserLocationLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const syncedFromLocalRef = useRef(false);

  /* Usuario logueado: suscribirse a Firestore */
  useEffect(() => {
    if (!user?.uid) return;
    const db = getFirestoreDb();
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        const arr = data?.addresses;
        const sid = data?.selectedAddressId;
        setDirecciones(Array.isArray(arr) ? (arr as DireccionGuardada[]) : []);
        setSelectedIdState(typeof sid === 'string' ? sid : null);
      },
      (err) => console.error('addresses snapshot', err)
    );
    return () => unsub();
  }, [user?.uid]);

  /* Usuario logueado por primera vez: migrar localStorage -> Firestore */
  useEffect(() => {
    if (!user?.uid || syncedFromLocalRef.current) return;
    const local = loadFromLocalStorage();
    const localSelected = typeof window !== 'undefined' ? localStorage.getItem(SELECTED_KEY) : null;
    if (local.length > 0) {
      syncedFromLocalRef.current = true;
      saveAddresses(user.uid, local).then(() => {
        if (localSelected) setSelectedAddress(user.uid, localSelected);
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(SELECTED_KEY);
        } catch (_) {}
      });
    }
  }, [user?.uid]);

  /* Sin usuario: usar localStorage */
  useEffect(() => {
    if (user?.uid) return;
    setDirecciones(loadFromLocalStorage());
    if (typeof window !== 'undefined') {
      const sid = localStorage.getItem(SELECTED_KEY);
      setSelectedIdState(sid);
    }
    setHydrated(true);
  }, [user?.uid]);

  /* Usuario: marcar hydrated cuando tengamos datos (onSnapshot los provee) */
  useEffect(() => {
    if (user?.uid) setHydrated(true);
  }, [user?.uid]);

  /* Pedir permiso de ubicación para cálculo de distancia (fallback si no hay dirección con coords) */
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (typeof latitude === 'number' && typeof longitude === 'number' && !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
          setUserLocationLatLng({ lat: latitude, lng: longitude });
        }
      },
      () => {},
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false }
    );
  }, []);

  const setSelectedId = useCallback(
    (id: string | null) => {
      setSelectedIdState(id);
      if (user?.uid) {
        setSelectedAddress(user.uid, id);
      } else if (typeof window !== 'undefined') {
        if (id) localStorage.setItem(SELECTED_KEY, id);
        else localStorage.removeItem(SELECTED_KEY);
      }
    },
    [user?.uid]
  );

  const updateDirecciones = useCallback(
    (dirs: DireccionGuardada[]) => {
      setDirecciones(dirs);
      if (user?.uid) {
        saveAddresses(user.uid, dirs);
      } else {
        saveToLocalStorage(dirs);
      }
    },
    [user?.uid]
  );

  const addDireccion = useCallback(
    (d: Omit<DireccionGuardada, 'id'>) => {
      const id = `dir-${Date.now()}`;
      const nueva: DireccionGuardada = { ...d, id };
      setDirecciones((prev) => {
        const next = [...prev, nueva];
        if (user?.uid) saveAddresses(user.uid, next);
        else saveToLocalStorage(next);
        return next;
      });
      setSelectedId(id);
    },
    [user?.uid, setSelectedId]
  );

  const setPrincipal = useCallback(
    (id: string) => {
      setDirecciones((prev) => {
        const next = prev.map((d) => ({ ...d, principal: d.id === id }));
        if (user?.uid) saveAddresses(user.uid, next);
        else saveToLocalStorage(next);
        return next;
      });
    },
    [user?.uid]
  );

  const removeDireccion = useCallback(
    (id: string) => {
      setDirecciones((prev) => {
        const next = prev.filter((d) => d.id !== id);
        if (user?.uid) saveAddresses(user.uid, next);
        else saveToLocalStorage(next);
        return next;
      });
      if (selectedId === id) setSelectedId(null);
    },
    [user?.uid, selectedId, setSelectedId]
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
    addDireccion,
    updateDirecciones,
    setPrincipal,
    removeDireccion,
    estaLejos,
  };

  return <AddressesContext.Provider value={value}>{children}</AddressesContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressesContext);
  if (!ctx) throw new Error('useAddresses must be used within AddressesProvider');
  return ctx;
}
