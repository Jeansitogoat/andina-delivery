'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ToastContainer, type ToastState, type ToastType } from '@/components/ToastContainer';

type ToastContextValue = {
  showToast: (_opts: { type: ToastType; message: string }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((opts: { type: ToastType; message: string }) => {
    setToast({ id: Date.now(), type: opts.type, message: opts.message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toast={toast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {},
    };
  }
  return ctx;
}

