'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { getIdToken } from '@/lib/authToken';
import { EmptyState } from '@/components/EmptyState';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClaimPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [state, setState] = useState<'checking' | 'redirecting' | 'taken' | 'forbidden' | 'error'>('checking');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (user.rol !== 'rider') {
      setState('forbidden');
      return;
    }

    let cancelled = false;
    const doClaim = async () => {
      try {
        const token = await getIdToken();
        if (!token || cancelled) {
          setState('error');
          return;
        }
        const res = await fetch(`/api/pedidos/${encodeURIComponent(id)}/claim`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (cancelled) return;
        if (res.status === 200) {
          setState('redirecting');
          router.replace('/panel/rider');
          return;
        }
        if (res.status === 409) {
          setState('taken');
          return;
        }
        if (res.status === 404) {
          setState('error');
          return;
        }
        setState('error');
      } catch {
        if (!cancelled) setState('error');
      }
    };

    doClaim();
    return () => {
      cancelled = true;
    };
  }, [id, user, loading, router]);

  if (state === 'checking' || state === 'redirecting') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
      </main>
    );
  }

  if (state === 'forbidden') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <EmptyState
          title="Solo para riders"
          description="Esta página es solo para repartidores de Andina."
          icon={<Package className="w-7 h-7" />}
          actionLabel="Ir al inicio"
          onAction={() => router.push('/')}
        />
      </main>
    );
  }

  if (state === 'taken') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <EmptyState
          title="Llegaste tarde"
          description="Otro rider ya tomó esta carrera. Pronto aparecerán más pedidos."
          icon={<Package className="w-7 h-7" />}
          actionLabel="Ir al panel del rider"
          onAction={() => router.push('/panel/rider')}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <EmptyState
        title="No se pudo reclamar la carrera"
        description="Intentá de nuevo desde tu panel del rider o verifica tu conexión."
        icon={<Package className="w-7 h-7" />}
        actionLabel="Ir al panel del rider"
        onAction={() => router.push('/panel/rider')}
      />
    </main>
  );
}

