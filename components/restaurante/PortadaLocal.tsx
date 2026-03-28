'use client';

import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import type { Local } from '@/lib/data';
import { getSafeImageSrc, shouldBypassImageOptimizer } from '@/lib/validImageUrl';

interface Props {
  local: Local;
  onVolver: () => void;
}

export default function PortadaLocal({ local, onVolver }: Props) {
  const safeCover = getSafeImageSrc(local.cover);
  return (
    <div className="relative">
      <div className="relative w-full h-52 md:h-72 bg-gray-200 overflow-hidden">
        {safeCover ? (
          <Image
            src={safeCover}
            alt={local.name}
            fill
            className="object-cover"
            sizes="100vw"
            priority
            unoptimized={shouldBypassImageOptimizer(local.cover)}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-transparent" />
      </div>
      <button
        type="button"
        onClick={onVolver}
        className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center backdrop-blur-sm transition-colors"
        aria-label="Volver"
      >
        <ArrowLeft className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}
