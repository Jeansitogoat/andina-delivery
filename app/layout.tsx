import type { Metadata, Viewport } from 'next';
import { SWRConfig } from 'swr';
import './globals.css';
import { AddressesProvider } from '@/lib/addressesContext';
import { CartProvider } from '@/lib/cartContext';
import AuthSplashGate from '@/components/AuthSplashGate';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import NotificationPromptBanner from '@/components/NotificationPromptBanner';

export const metadata: Metadata = {
  title: 'Andina',
  description: 'Delivery oficial - Restaurantes, Market y Farmacias',
  manifest: '/manifest.json',
  icons: { icon: '/logo-andina.png', apple: '/logo-andina.png' },
};

export const viewport: Viewport = {
  themeColor: '#c40f0f',
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
        <meta name="apple-mobile-web-app-title" content="Andina" />
      </head>
      <body className="min-h-screen flex flex-col bg-gray-50">
        <SWRConfig value={{ revalidateOnFocus: false, dedupingInterval: 30000 }}>
          <AddressesProvider>
            <CartProvider>
              <AuthSplashGate>{children}</AuthSplashGate>
              <PWAInstallBanner />
              <NotificationPromptBanner />
            </CartProvider>
          </AddressesProvider>
        </SWRConfig>
      </body>
    </html>
  );
}
