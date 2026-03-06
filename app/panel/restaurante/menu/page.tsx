'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirige a la versión con [id]; los datos vienen de la API/Firestore. */
const DEFAULT_LOCAL_ID = 'rhk';

export default function PanelMenuPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/panel/restaurante/${DEFAULT_LOCAL_ID}/menu`);
  }, [router]);
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Redirigiendo...</p>
    </div>
  );
}
