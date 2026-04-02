import type { Metadata, Viewport } from 'next';
import { SWRConfig } from 'swr';
import './globals.css';
import { AddressesProvider } from '@/lib/addressesContext';
import { CartProvider } from '@/lib/cartContext';
import { FullScreenModalProvider } from '@/lib/FullScreenModalContext';
import { PublicConfigProvider } from '@/lib/PublicConfigContext';
import { AndinaProvider } from '@/lib/AndinaContext';
import { NetworkStatusProvider } from '@/lib/NetworkStatusContext';
import { NetworkBanner } from '@/components/NetworkBanner';
import { ToastProvider } from '@/lib/ToastContext';
import AuthSplashGate from '@/components/AuthSplashGate';
import ErrorBoundary from '@/components/ErrorBoundary';
import FCMAutoRegister from '@/components/FCMAutoRegister';
import AppLaunchTracker from '@/components/AppLaunchTracker';
import { PWAInstallPromptProvider } from '@/components/PWAInstallPromptProvider';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import NotificationPromptBanner from '@/components/NotificationPromptBanner';
import NotificationShield from '@/components/NotificationShield';
import LocationBackupBanner from '@/components/LocationBackupBanner';

export const metadata: Metadata = {
  title: 'Andina Delivery - Piñas',
  description: 'Delivery oficial - Restaurantes, Market y Farmacias',
  manifest: '/manifest.json',
  icons: { icon: '/logo-andina.png', apple: '/logo-andina.png' },
};

export const viewport: Viewport = {
  themeColor: '#c40f0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Andina Delivery - Piñas" />
      </head>
      <body className="min-h-screen flex flex-col bg-surface">
        <SWRConfig value={{ revalidateOnFocus: false, dedupingInterval: 30000 }}>
          <ErrorBoundary>
          <NetworkStatusProvider>
          <ToastProvider>
          <NetworkBanner />
          <AppLaunchTracker>
          <PWAInstallPromptProvider>
          <AndinaProvider>
            <PublicConfigProvider>
              <AddressesProvider>
                <CartProvider>
                  <FullScreenModalProvider>
                    <AuthSplashGate>{children}</AuthSplashGate>
                    <FCMAutoRegister />
                    <PWAInstallBanner />
                    <NotificationPromptBanner />
                    <NotificationShield />
                    <LocationBackupBanner />
                  </FullScreenModalProvider>
                </CartProvider>
              </AddressesProvider>
            </PublicConfigProvider>
          </AndinaProvider>
          </PWAInstallPromptProvider>
          </AppLaunchTracker>
          </ToastProvider>
          </NetworkStatusProvider>
          </ErrorBoundary>
        </SWRConfig>
      </body>
    </html>
  );
}
