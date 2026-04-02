'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowDown, Monitor, MoreHorizontal, Plus, Share2 } from 'lucide-react';
import { usePWAInstallPrompt } from '@/components/PWAInstallPromptProvider';
import { useDevicePlatform } from '@/hooks/useDevicePlatform';
import { Z_ONBOARDING } from '@/lib/zIndex';
import { STORAGE_PWA_ONBOARDING_DONE } from '@/lib/andinaStorageKeys';

function setOnboardingDone(value: 'skipped' | 'done') {
  try {
    localStorage.setItem(STORAGE_PWA_ONBOARDING_DONE, value);
  } catch {
    /* modo privado */
  }
}

export default function InstallOnboarding({ onDone }: { onDone: () => void }) {
  const { platform, isStandalone } = useDevicePlatform();
  const { deferredPrompt, promptInstall } = usePWAInstallPrompt();
  const [installLoading, setInstallLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (isStandalone) {
      setOnboardingDone('done');
      onDone();
    }
  }, [isStandalone, onDone]);

  const handleSkip = useCallback(() => {
    setOnboardingDone('skipped');
    onDone();
  }, [onDone]);

  const handleAndroidInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstallLoading(true);
    try {
      const result = await promptInstall();
      if (result?.outcome === 'accepted') {
        setOnboardingDone('done');
        onDone();
      }
    } finally {
      setInstallLoading(false);
    }
  }, [deferredPrompt, promptInstall, onDone]);

  const zStyle = { zIndex: Z_ONBOARDING };

  if (!ready) {
    return (
      <div
        className="fixed inset-0 bg-[#0f0f0f] z-[9985]"
        aria-hidden
      />
    );
  }

  if (platform === 'ios' && !isStandalone) {
    return (
      <div
        className="fixed inset-0 flex flex-col bg-[#0f0f0f] text-white"
        style={zStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-onboarding-title"
      >
        <header
          className="shrink-0 flex justify-end px-3 bg-[#0f0f0f]/95 backdrop-blur-md border-b border-white/5"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            onClick={handleSkip}
            className="py-2 px-3 text-sm font-medium text-white/80 hover:text-white rounded-lg min-h-[44px] min-w-[44px]"
          >
            Omitir
          </button>
        </header>

        <div className="flex-1 overflow-y-auto flex flex-col items-center px-6 pt-8 pb-4">
          <Image
            src="/logo-andina.png"
            alt=""
            width={72}
            height={72}
            className="object-contain rounded-2xl"
            priority
          />
          <h1 id="install-onboarding-title" className="mt-4 text-xl font-black tracking-tight">
            Andina Express
          </h1>
          <p className="text-sm text-white/60 mt-1 text-center">Delivery y mandados en Piñas</p>
        </div>

        <div
          className="shrink-0 mx-3 mb-3 rounded-2xl border border-white/10 bg-white/[0.07] backdrop-blur-xl px-4 py-4 shadow-2xl max-h-[55vh] overflow-y-auto"
          style={{ marginBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <p className="text-xs font-semibold text-white/95 text-center tracking-wide uppercase">
            Instalar en la pantalla de inicio
          </p>
          <p className="text-[12px] leading-relaxed text-white/70 text-center mt-2">
            Safari no tiene botón “Instalar” como Android. Hay que usar <strong className="text-white/90">Compartir</strong> y
            luego <strong className="text-white/90">Agregar a la pantalla de inicio</strong>.
          </p>

          <div className="mt-4 rounded-xl bg-black/25 border border-white/10 px-3 py-3 text-left">
            <p className="text-[11px] font-semibold text-white/85 mb-2">1. Abre Compartir (según tu iPhone)</p>
            <ul className="space-y-2.5 text-[11px] leading-snug text-white/75">
              <li className="flex gap-2">
                <span className="shrink-0 w-9 h-9 rounded-lg bg-white/12 flex items-center justify-center border border-white/15">
                  <Share2 className="w-4 h-4 text-white" strokeWidth={2} />
                </span>
                <span>
                  <strong className="text-white/90">Flecha hacia arriba</strong> en la barra inferior (cuadrado con flecha): eso es <strong>Compartir</strong>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-9 h-9 rounded-lg bg-white/12 flex items-center justify-center border border-white/15">
                  <MoreHorizontal className="w-4 h-4 text-white" strokeWidth={2.5} />
                </span>
                <span>
                  <strong className="text-white/90">Tres puntos ···</strong> arriba a la derecha: tócalos y elige <strong className="text-white/90">Compartir</strong>.
                </span>
              </li>
            </ul>
          </div>

          <p className="text-[12px] text-center text-white/80 mt-3 leading-snug">
            <strong className="text-white">2.</strong> En la hoja que se abre, busca{' '}
            <strong className="text-white">Agregar a la pantalla de inicio</strong> o <strong className="text-white">Agregar al inicio</strong>.
          </p>

          <div className="flex items-center justify-center gap-2 sm:gap-4 mt-4 mb-1 flex-wrap">
            <div className="flex flex-col items-center gap-1 min-w-[4.5rem]">
              <div className="w-12 h-12 rounded-xl bg-white/12 flex items-center justify-center border border-white/18">
                <Share2 className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <span className="text-[9px] uppercase tracking-wider text-white/45">Compartir</span>
            </div>
            <span className="text-white/35 text-lg" aria-hidden>
              →
            </span>
            <div className="flex flex-col items-center gap-1 min-w-[4.5rem]">
              <div className="w-12 h-12 rounded-xl bg-white/12 flex items-center justify-center border border-white/18">
                <Plus className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <span className="text-[9px] uppercase tracking-wider text-white/45">Añadir</span>
            </div>
          </div>

          <p className="text-[10px] text-center text-white/45 mt-3 flex flex-col items-center gap-1">
            <span className="inline-flex items-center gap-1">
              <ArrowDown className="w-3 h-3 shrink-0" aria-hidden />
              Si no ves la barra de Safari, desliza desde el borde inferior de la pantalla.
            </span>
          </p>
        </div>
      </div>
    );
  }

  if (platform === 'android' && !isStandalone) {
    return (
      <div
        className="fixed inset-0 flex flex-col bg-surface"
        style={zStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-onboarding-title-android"
      >
        <header
          className="shrink-0 flex justify-end px-3 bg-[#0f0f0f] border-b border-white/5"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            onClick={handleSkip}
            className="py-2 px-3 text-sm font-medium text-white/80 hover:text-white rounded-lg min-h-[44px]"
          >
            Omitir
          </button>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-gray-100 text-center">
            <Image
              src="/logo-andina.png"
              alt=""
              width={80}
              height={80}
              className="object-contain mx-auto rounded-2xl"
              priority
            />
            <h2
              id="install-onboarding-title-android"
              className="mt-5 text-xl font-black text-gray-900"
            >
              Instala la app
            </h2>
            <p className="text-sm text-gray-500 mt-2">Un toque y listo: icono en el inicio, mejor GPS y avisos.</p>
            <button
              type="button"
              onClick={handleAndroidInstall}
              disabled={!deferredPrompt || installLoading}
              className="mt-8 w-full py-4 rounded-2xl bg-rojo-andino text-white font-bold text-base hover:bg-rojo-andino/90 disabled:opacity-60 transition-colors"
            >
              {installLoading ? 'Un momento…' : deferredPrompt ? 'Instalar app' : 'Preparando instalación…'}
            </button>
            {!deferredPrompt ? (
              <p className="text-xs text-gray-400 mt-3">
                Menú del navegador (⋮) → Instalar app o Añadir a la pantalla de inicio.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  /* Desktop u otros: instrucciones barra de direcciones */
  return (
    <div
      className="fixed inset-0 flex flex-col bg-surface"
      style={zStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-onboarding-title-desk"
    >
      <header
        className="shrink-0 flex justify-end px-3 bg-[#0f0f0f] border-b border-white/5"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={handleSkip}
          className="py-2 px-3 text-sm font-medium text-white/80 hover:text-white rounded-lg min-h-[44px]"
        >
          Omitir
        </button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-gray-100 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rojo-andino/10 flex items-center justify-center">
            <Monitor className="w-8 h-8 text-rojo-andino" />
          </div>
          <h2 id="install-onboarding-title-desk" className="mt-5 text-xl font-black text-gray-900">
            Instala en tu PC
          </h2>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            En <strong className="text-gray-800">Chrome</strong> o <strong className="text-gray-800">Edge</strong>, pulsa el
            icono <strong className="text-gray-900">⊕ Instalar</strong> junto a la barra de direcciones y confirma. Eso es
            todo: acceso rápido y notificaciones.
          </p>
        </div>
      </div>
    </div>
  );
}
