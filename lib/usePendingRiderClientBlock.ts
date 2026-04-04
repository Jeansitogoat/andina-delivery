'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

/**
 * Riders sin aprobación no deben usar la tienda (home, carrito, checkout).
 * Redirige a /panel/rider (pantalla de espera del panel).
 */
export function usePendingRiderClientBlock(): void {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    if (user.rol !== 'rider') return;
    if (user.riderStatus === 'approved') return;
    router.replace('/panel/rider');
  }, [loading, user, router]);
}
