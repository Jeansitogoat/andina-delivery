'use client';

import { useRouter } from 'next/navigation';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'linear-gradient(160deg, #c9960d 0%, #a67a08 55%, #7a5606 100%)' }}
    >
      {/* número grande decorativo */}
      <div className="relative mb-6 select-none">
        <span
          className="font-black text-[140px] leading-none text-white/10 block"
          style={{ letterSpacing: '-6px' }}
        >
          404
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl">
            <Search className="w-10 h-10 text-white" />
          </div>
        </div>
      </div>

      {/* texto */}
      <h1 className="font-black text-2xl text-white mb-2">¡Ups! Página no encontrada</h1>
      <p className="text-white/70 text-sm max-w-xs mb-8 leading-relaxed">
        La dirección que buscas no existe o fue movida. Vuelve al inicio y encuentra lo que necesitas.
      </p>

      {/* botones */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full py-4 rounded-2xl bg-white text-gray-900 font-black text-base flex items-center justify-center gap-2 shadow-lg hover:bg-white/90 transition-all active:scale-95"
        >
          <Home className="w-5 h-5" />
          Ir al inicio
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full py-4 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-base flex items-center justify-center gap-2 border border-white/20 transition-all active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver atrás
        </button>
      </div>

      {/* marca */}
      <p className="text-white/40 text-xs mt-10 font-semibold tracking-widest uppercase">
        Andina · Piñas, El Oro
      </p>
    </main>
  );
}
