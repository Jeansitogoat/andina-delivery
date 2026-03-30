'use client';

import { useEffect, useRef } from 'react';

/**
 * Mantiene un único HTMLAudioElement y, en el primer pointerdown del documento,
 * intenta un play() breve a bajo volumen para cumplir políticas de autoplay del navegador.
 */
export function useOrderSoundAutoplayUnlock(soundSrc: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = new Audio(soundSrc);
    a.preload = 'auto';
    audioRef.current = a;

    let consumed = false;
    const opts = { passive: true, capture: true } as const;
    const unlock = () => {
      if (consumed) return;
      consumed = true;
      const el = audioRef.current;
      if (!el) return;
      const prevVol = el.volume;
      el.volume = 0.05;
      void el
        .play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.volume = prevVol > 0 ? prevVol : 1;
        })
        .catch(() => {
          el.volume = prevVol > 0 ? prevVol : 1;
        });
    };

    document.addEventListener('pointerdown', unlock, opts);
    return () => {
      document.removeEventListener('pointerdown', unlock, opts);
      audioRef.current = null;
    };
  }, [soundSrc]);

  return audioRef;
}
