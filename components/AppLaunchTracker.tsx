'use client';

import { LaunchCountProvider } from '@/lib/launchCount';

/** Envuelve la app e incrementa `andina_launch_count` una vez por sesión. */
export default function AppLaunchTracker({ children }: { children: React.ReactNode }) {
  return <LaunchCountProvider>{children}</LaunchCountProvider>;
}
