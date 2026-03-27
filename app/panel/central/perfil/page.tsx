'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import ProfileSettingsForm from '@/components/panel/ProfileSettingsForm';

export default function CentralPerfilPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user || (user.rol !== 'central' && user.rol !== 'maestro')) {
      router.replace('/auth');
    }
  }, [user, loading, router]);

  if (loading || !user || (user.rol !== 'central' && user.rol !== 'maestro')) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      <header
        className="text-white px-4 pt-10 pb-6"
        style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 60%, #5b21b6 100%)' }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/panel/central')}
            className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            aria-label="Volver al panel"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <User className="w-6 h-6" />
            <div>
              <h1 className="text-xl font-black tracking-tight">Editar perfil</h1>
              <p className="text-sm text-white/80">Central</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        <ProfileSettingsForm variant="central" />
      </div>
    </main>
  );
}
