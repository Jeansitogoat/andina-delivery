'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

type ContextValue = {
  /** true cuando algún modal de pantalla completa (ej. Nueva ubicación) está abierto */
  isOpen: boolean;
  register: () => void;
  unregister: () => void;
};

const FullScreenModalContext = createContext<ContextValue | null>(null);

export function FullScreenModalProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const register = useCallback(() => setCount((c) => c + 1), []);
  const unregister = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);
  const isOpen = count > 0;
  return (
    <FullScreenModalContext.Provider value={{ isOpen, register, unregister }}>
      {children}
    </FullScreenModalContext.Provider>
  );
}

export function useFullScreenModal() {
  const ctx = useContext(FullScreenModalContext);
  return ctx ?? { isOpen: false, register: () => {}, unregister: () => {} };
}
