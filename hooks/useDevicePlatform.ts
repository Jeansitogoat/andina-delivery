'use client';

import { useState, useEffect } from 'react';

export type DevicePlatform = 'android' | 'ios' | 'desktop';

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    !!(window.navigator as { standalone?: boolean }).standalone ||
    document.referrer.includes('android-app://')
  );
}

export function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function detectAndroidChrome(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent);
}

function detectLikelyDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const hover = window.matchMedia('(hover: hover)').matches;
    return fine && hover;
  } catch {
    return window.innerWidth >= 1024;
  }
}

function computePlatform(): DevicePlatform {
  if (typeof window === 'undefined') return 'desktop';
  if (detectIOS()) return 'ios';
  if (/Android/.test(navigator.userAgent)) return 'android';
  if (detectLikelyDesktop()) return 'desktop';
  return 'desktop';
}

export type DevicePlatformState = {
  platform: DevicePlatform;
  isStandalone: boolean;
  isIOS: boolean;
  isAndroidChrome: boolean;
  likelyDesktop: boolean;
};

export function useDevicePlatform(): DevicePlatformState {
  const [state, setState] = useState<DevicePlatformState>(() => ({
    platform: 'desktop',
    isStandalone: false,
    isIOS: false,
    isAndroidChrome: false,
    likelyDesktop: false,
  }));

  useEffect(() => {
    const isStandalone = detectStandalone();
    const isIOS = detectIOS();
    const isAndroidChrome = detectAndroidChrome();
    const likelyDesktop = detectLikelyDesktop();
    setState({
      platform: computePlatform(),
      isStandalone,
      isIOS,
      isAndroidChrome,
      likelyDesktop,
    });
  }, []);

  return state;
}
