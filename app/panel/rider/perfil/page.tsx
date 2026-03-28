'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import ProfileSettingsForm from '@/components/panel/ProfileSettingsForm';

export default function RiderPerfilPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user || (user.rol !== 'rider' && user.rol !== 'maestro')) {
      router.replace('/auth');
    }
  }, [user, loading, router]);

  if (loading || !user || (user.rol !== 'rider' && user.rol !== 'maestro')) {
    return (
      <main className="surface-rider min-h-screen flex items-center justify-center">
        <p className="text-sm text-white/80">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="surface-rider min-h-screen pb-10">
      <header className="text-white safe-x pt-8 pb-6 bg-gradient-to-br from-rider-900 via-rider-700 to-rider-600 shadow-softlg">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/panel/rider')}
            className="touch-target-lg inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25"
            aria-label="Volver al panel"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <User className="w-6 h-6" />
            <div>
              <h1 className="text-xl font-black tracking-tight">Editar perfil</h1>
              <p className="text-sm text-blue-100">Rider</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto safe-x mt-6 px-4">
        <ProfileSettingsForm variant="rider" notificationRole="rider" />
      </div>
    </main>
  );
}
