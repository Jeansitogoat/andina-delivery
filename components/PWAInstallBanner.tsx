'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstallPrompt } from '@/components/PWAInstallPromptProvider';
import { useLaunchCount, isBackupLaunchEligible } from '@/lib/launchCount';

const SESSION_DISMISS_ANDROID = 'andina_pwa_android_floating_dismissed';
const SESSION_DISMISS_IOS = 'andina_pwa_ios_floating_dismissed';

export default function PWAInstallBanner() {
  const pathname = usePathname();
  const launchCount = useLaunchCount();
  const { deferredPrompt, promptInstall } = usePWAInstallPrompt();
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [installed, setInstalled] = useState(false);

  const backupOk = isBackupLaunchEligible(launchCount);
  const hideOnAuth = pathname === '/auth';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hideOnAuth) return;
    if (!backupOk) return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setInstalled(true);
      return;
    }

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidChrome = /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent);

    let androidClosed = false;
    let iosClosed = false;
    try {
      androidClosed = sessionStorage.getItem(SESSION_DISMISS_ANDROID) === '1';
      iosClosed = sessionStorage.getItem(SESSION_DISMISS_IOS) === '1';
    } catch {
      /* modo privado */
    }

    if (isAndroidChrome && deferredPrompt && !androidClosed) {
      setShowAndroidBanner(true);
    } else {
      setShowAndroidBanner(false);
    }

    if (isIOS && !iosClosed) {
      setShowIOSBanner(true);
    } else {
      setShowIOSBanner(false);
    }

    return undefined;
  }, [hideOnAuth, backupOk, deferredPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    const result = await promptInstall();
    if (result?.outcome === 'accepted') {
      setShowAndroidBanner(false);
      setInstalled(true);
    }
  };

  const dismissIOS = () => {
    setShowIOSBanner(false);
    try {
      sessionStorage.setItem(SESSION_DISMISS_IOS, '1');
    } catch {
      /* modo privado */
    }
  };

  const dismissAndroid = () => {
    setShowAndroidBanner(false);
    try {
      sessionStorage.setItem(SESSION_DISMISS_ANDROID, '1');
    } catch {
      /* modo privado */
    }
  };

  if (installed) return null;
  if (hideOnAuth) return null;
  if (!backupOk) return null;
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
              onClick={dismissAndroid}
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
                Para instalar: Toca el botón de Compartir y selecciona Agregar al inicio
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
