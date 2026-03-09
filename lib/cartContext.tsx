'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase/client';
import { useAuth } from '@/lib/useAuth';
import { saveCart, type CartState } from '@/lib/cartFirestore';

export interface CartItem {
  id: string;
  qty: number;
  note?: string;
}

export interface CartStop {
  localId: string;
  items: CartItem[];
}

export type { CartState };

const STORAGE_KEY = 'andina_cart';

function loadCartFromStorage(): CartState {
  if (typeof window === 'undefined') return { stops: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { stops: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.stops)) return parsed as CartState;
    if (parsed.localId && Array.isArray(parsed.items)) {
      return { stops: parsed.items.length > 0 ? [{ localId: parsed.localId, items: parsed.items }] : [] };
    }
    return { stops: [] };
  } catch {
    return { stops: [] };
  }
}

function saveCartToStorage(cart: CartState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* Silencioso en móvil (modo privado, WebView, etc.) */
  }
}

type CartContextType = {
  cart: CartState;
  cartCount: number;
  hydrated: boolean;
  addItem: (_localId: string, _itemId: string, _note?: string) => void;
  removeItem: (_itemId: string, _localId?: string) => void;
  clearCart: () => void;
  replaceCart: (_stops: CartStop[]) => void;
  /** Reemplaza el carrito y devuelve una promesa que se resuelve cuando se guardó en Firestore. */
  replaceCartAndSave: (_stops: CartStop[]) => Promise<void>;
  clearStop: (_localId: string) => void;
  setItemNote: (_itemId: string, _note: string, _localId?: string) => void;
  localId: string | null;
  items: CartItem[];
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartState>({ stops: [] });
  const [hydrated, setHydrated] = useState(false);
  const syncedFromLocalRef = useRef(false);

  /** Una lectura getDoc por carga o tras guardar; evita listener permanente (Opción B: máximo ahorro lecturas). */
  const refetchCart = useCallback(() => {
    if (!user?.uid) return;
    const db = getFirestoreDb();
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        const data = snap.data();
        const c = data?.cart;
        if (c && Array.isArray(c.stops)) {
          setCart(c as CartState);
        } else {
          setCart({ stops: [] });
        }
      })
      .catch((err) => console.error('cart refetch', err));
  }, [user?.uid]);

  /* Carga inicial desde Firestore (getDoc una vez al montar con usuario). */
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    const db = getFirestoreDb();
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.data();
        const c = data?.cart;
        if (c && Array.isArray(c.stops)) {
          setCart(c as CartState);
        } else {
          setCart({ stops: [] });
        }
      })
      .catch((err) => {
        if (!cancelled) console.error('cart initial load', err);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || syncedFromLocalRef.current) return;
    const local = loadCartFromStorage();
    if (local.stops.length > 0) {
      syncedFromLocalRef.current = true;
      const doSave = () => {
        saveCart(user.uid, local)
          .then(() => {
            refetchCart();
            try {
              localStorage.removeItem(STORAGE_KEY);
            } catch {
              // ignore
            }
          })
          .catch((err) => {
            console.error('cart sync saveCart', err);
            const msg = String(err?.message ?? '').toLowerCase();
            if (msg.includes('permission') || msg.includes('insufficient')) {
              setTimeout(() => {
                saveCart(user.uid, local).then(() => refetchCart()).catch(() => {});
              }, 600);
            }
          });
      };
      doSave();
    }
  }, [user?.uid, refetchCart]);

  useEffect(() => {
    if (user?.uid) return;
    setCart(loadCartFromStorage());
  }, [user?.uid]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const updateCart = useCallback(
    (updater: (_prev: CartState) => CartState) => {
      setCart((prev) => {
        const next = updater(prev);
        if (user?.uid) {
          saveCart(user.uid, next)
            .then(() => refetchCart())
            .catch((err) => {
              console.error('cart saveCart', err);
            });
        } else {
          saveCartToStorage(next);
        }
        return next;
      });
    },
    [user?.uid, refetchCart]
  );

  const addItem = useCallback(
    (localId: string, itemId: string, note?: string) => {
      updateCart((prev) => {
        const stopIndex = prev.stops.findIndex((s) => s.localId === localId);
        const baseStop = stopIndex >= 0 ? prev.stops[stopIndex] : { localId, items: [] as CartItem[] };
        const existing = baseStop.items.find((i) => i.id === itemId);
        const newItems = existing
          ? baseStop.items.map((i) =>
              i.id === itemId ? { ...i, qty: i.qty + 1, note: note ?? i.note } : i
            )
          : [...baseStop.items, { id: itemId, qty: 1, note }];
        const newStop = { localId, items: newItems };
        if (stopIndex >= 0) {
          const stops = [...prev.stops];
          stops[stopIndex] = newStop;
          return { stops };
        }
        return { stops: [...prev.stops, newStop] };
      });
    },
    [updateCart]
  );

  const removeItem = useCallback(
    (itemId: string, localId?: string) => {
      updateCart((prev) => {
        const targetStopIndex = localId != null
          ? prev.stops.findIndex((s) => s.localId === localId)
          : prev.stops.findIndex((s) => s.items.some((i) => i.id === itemId));
        if (targetStopIndex < 0) return prev;
        const stop = prev.stops[targetStopIndex];
        const existing = stop.items.find((i) => i.id === itemId);
        if (!existing) return prev;
        const newItems =
          existing.qty === 1
            ? stop.items.filter((i) => i.id !== itemId)
            : stop.items.map((i) => (i.id === itemId ? { ...i, qty: i.qty - 1 } : i));
        const stops = [...prev.stops];
        if (newItems.length === 0) stops.splice(targetStopIndex, 1);
        else stops[targetStopIndex] = { ...stop, items: newItems };
        return { stops };
      });
    },
    [updateCart]
  );

  const clearCart = useCallback(() => {
    updateCart(() => ({ stops: [] }));
  }, [updateCart]);

  const replaceCart = useCallback(
    (stops: CartStop[]) => {
      updateCart(() => ({ stops: stops.map((s) => ({ localId: s.localId, items: [...s.items] })) }));
    },
    [updateCart]
  );

  const replaceCartAndSave = useCallback(
    async (stops: CartStop[]) => {
      const next: CartState = { stops: stops.map((s) => ({ localId: s.localId, items: [...s.items] })) };
      setCart(next);
      if (user?.uid) {
        try {
          await saveCart(user.uid, next);
          refetchCart();
        } catch (err) {
          console.error('replaceCartAndSave saveCart', err);
        }
      } else {
        saveCartToStorage(next);
      }
    },
    [user?.uid, refetchCart]
  );

  const clearStop = useCallback(
    (localId: string) => {
      updateCart((prev) => ({
        stops: prev.stops.filter((s) => s.localId !== localId),
      }));
    },
    [updateCart]
  );

  const setItemNote = useCallback(
    (itemId: string, note: string, localId?: string) => {
      updateCart((prev) => ({
        stops: prev.stops.map((s) => {
          if (localId != null && s.localId !== localId) return s;
          const hasItem = s.items.some((i) => i.id === itemId);
          if (!hasItem) return s;
          return {
            ...s,
            items: s.items.map((i) => (i.id === itemId ? { ...i, note } : i)),
          };
        }),
      }));
    },
    [updateCart]
  );

  const cartCount = cart.stops.reduce((s, stop) => s + stop.items.reduce((a, i) => a + i.qty, 0), 0);
  const singleStop = cart.stops.length === 1 ? cart.stops[0] : null;
  const firstStop = cart.stops[0] ?? null;
  const localId = singleStop?.localId ?? firstStop?.localId ?? null;
  const items = singleStop?.items ?? firstStop?.items ?? [];

  const value: CartContextType = {
    cart,
    cartCount,
    hydrated,
    addItem,
    removeItem,
    clearCart,
    replaceCart,
    replaceCartAndSave,
    clearStop,
    setItemNote,
    localId,
    items,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
