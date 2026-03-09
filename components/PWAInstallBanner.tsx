'use client';

import { useState, useEffect } from 'react';
import { Download, Share, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as { standalone?: boolean }).standalone
      || document.referrer.includes('android-app://');

    if (isStandalone) {
      setInstalled(true);
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroidChrome = /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroidBanner(true);
    };

    if (isAndroidChrome) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    }

    if (isIOS) {
      const key = 'andina_pwa_ios_banner_dismissed';
      try {
        const dismissedAt = sessionStorage.getItem(key);
        if (!dismissedAt) {
          setShowIOSBanner(true);
        }
      } catch {
        /* Silencioso en móvil (modo privado, WebView, etc.) */
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowAndroidBanner(false);
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const dismissIOS = () => {
    setShowIOSBanner(false);
    try {
      sessionStorage.setItem('andina_pwa_ios_banner_dismissed', Date.now().toString());
    } catch {
      /* Silencioso en móvil (modo privado, WebView, etc.) */
    }
  };

  if (installed) return null;
  if (!showAndroidBanner && !showIOSBanner) return null;

  if (showAndroidBanner) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto animate-fade-in">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
            <Download className="w-6 h-6 text-rojo-andino" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">Instalar Andina</p>
            <p className="text-xs text-gray-500">Usa la app como en tu teléfono</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-4 py-2 rounded-xl bg-rojo-andino text-white font-bold text-sm hover:bg-rojo-andino/90 transition-colors"
            >
              Instalar
            </button>
            <button
              type="button"
              onClick={() => setShowAndroidBanner(false)}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showIOSBanner) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto animate-fade-in">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
              <Share className="w-5 h-5 text-rojo-andino" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">Añadir Andina a tu iPhone</p>
              <p className="text-xs text-gray-600 mt-1.5">
                1. Toca el botón <strong>Compartir</strong> (flecha hacia arriba) o los <strong>tres puntitos</strong> (...) en la barra de abajo
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                2. Elige <strong>Añadir a pantalla de inicio</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={dismissIOS}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-500 flex-shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
