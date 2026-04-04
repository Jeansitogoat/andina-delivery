'use client';

import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';

/** z-index por encima de splash, onboarding y modales (ver lib/zIndex). */
const Z_WALL = 2147483646;

export default function PWAInstallSuccessWall({ open }: { open: boolean }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-8 px-8 bg-[#0f0f0f] text-center text-white"
      style={{ zIndex: Z_WALL }}
      role="alert"
      aria-live="polite"
    >
      <Image
        src="/logo-andina.png"
        alt="Andina"
        width={160}
        height={160}
        className="object-contain rounded-3xl drop-shadow-lg"
        priority
      />
      <div className="flex flex-col items-center gap-3 max-w-md">
        <CheckCircle2 className="w-16 h-16 text-emerald-400" strokeWidth={2} aria-hidden />
        <p className="text-lg sm:text-xl font-semibold leading-relaxed">
          ¡Andina instalada con éxito! 🎉 Por favor, cierra este navegador y abre la aplicación desde la
          pantalla de inicio de tu celular para continuar.
        </p>
      </div>
    </div>
  );
}
