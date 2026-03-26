'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('Global error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 px-4">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-orange-100">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-9 h-9 text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 text-center mb-2">
          Algo salió mal
        </h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Hubo un error inesperado al cargar esta pantalla. Puedes intentar
          de nuevo o volver al inicio.
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-rojo-andino text-white font-semibold py-3.5 hover:bg-rojo-andino/90 transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 text-gray-800 font-semibold py-3.5 hover:bg-gray-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}

