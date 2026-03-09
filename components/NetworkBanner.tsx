'use client';

import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/lib/NetworkStatusContext';

export function NetworkBanner() {
  const { online } = useNetworkStatus();
  if (online) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-white text-xs sm:text-sm py-1.5 px-4 text-center flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" />
      <span>Sin conexión – Tus cambios se guardarán al reconectar.</span>
    </div>
  );
}

