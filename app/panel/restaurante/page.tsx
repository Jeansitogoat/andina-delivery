'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

export default function PanelRestaurantePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (user.rol === 'local' && user.localId) {
      router.replace(`/panel/restaurante/${user.localId}`);
      return;
    }
    if (user.rol === 'local' && !user.localId) {
      router.replace('/auth');
      return;
    }
    if (user.rol === 'maestro') {
      router.replace('/panel/maestro');
      return;
    }
    router.replace('/auth');
  }, [user, loading, router]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Redirigiendo al panel...</p>
    </main>
  );
}
