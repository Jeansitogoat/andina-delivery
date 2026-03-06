'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ShoppingBag, UtensilsCrossed, User, BarChart2 } from 'lucide-react';

function getBasePath(pathname: string): string {
  const parts = pathname.split('/');
  // /panel/restaurante/rhk or /panel/restaurante/rhk/menu -> base = /panel/restaurante/rhk
  if (parts[1] === 'panel' && parts[2] === 'restaurante' && parts[3] && !['menu', 'perfil', 'stats'].includes(parts[3])) {
    return `/panel/restaurante/${parts[3]}`;
  }
  return '/panel/restaurante';
}

export default function NavPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const base = getBasePath(pathname);

  const TABS = [
    { href: base, label: 'Pedidos', icon: ShoppingBag },
    { href: `${base}/menu`, label: 'Menú', icon: UtensilsCrossed },
    { href: `${base}/perfil`, label: 'Perfil', icon: User },
    { href: `${base}/stats`, label: 'Stats', icon: BarChart2 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 shadow-lg">
      <div className="max-w-2xl mx-auto flex">
        {TABS.map(({ href, label, icon: Icon }) => {
          const activo = pathname === href || (href !== base && pathname.startsWith(href));
          return (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                activo ? 'text-rojo-andino' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${activo ? 'text-rojo-andino' : 'text-gray-400'}`} />
              {label}
              {activo && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-rojo-andino rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
