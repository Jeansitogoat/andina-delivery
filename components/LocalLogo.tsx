'use client';

import { useState } from 'react';
import Image from 'next/image';
import { UtensilsCrossed } from 'lucide-react';
import { getSafeImageSrc, shouldBypassImageOptimizer } from '@/lib/validImageUrl';

interface LocalLogoProps {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  unoptimized?: boolean;
  iconClassName?: string;
  /** Prioridad LCP: carga antes que otras imágenes (primer banner, primeros 4 logos) */
  priority?: boolean;
}

/** Logo de local con fallback a ícono si la imagen no existe o falla al cargar (evita ERR_INVALID_URL y 404). */
export default function LocalLogo({
  src,
  alt,
  fill = true,
  className = '',
  sizes,
  unoptimized,
  iconClassName = 'w-12 h-12 text-rojo-andino/40',
  priority,
}: LocalLogoProps) {
  const [error, setError] = useState(false);
  const safeSrc = getSafeImageSrc(src);
  const showFallback = !safeSrc || error;

  if (showFallback) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 ${className}`}
        style={fill ? { position: 'absolute', inset: 0 } : undefined}
      >
        <UtensilsCrossed className={iconClassName} />
      </div>
    );
  }

  return (
    <Image
      src={safeSrc}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      unoptimized={unoptimized ?? shouldBypassImageOptimizer(safeSrc)}
      priority={priority}
      onError={() => setError(true)}
    />
  );
}
