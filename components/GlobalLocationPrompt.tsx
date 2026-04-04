'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAddresses } from '@/lib/addressesContext';
import { useAuth } from '@/lib/useAuth';
import LocationAddressFlow from '@/components/LocationAddressFlow';

const SESSION_KEY = 'andina_location_onboarding_done';

function isOperarioSinModoCliente(
  rol: string | undefined,
  modoCliente: boolean
): boolean {
  if (modoCliente) return false;
  return rol === 'rider' || rol === 'central' || rol === 'local' || rol === 'maestro';
}

export default function GlobalLocationPrompt() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { direccionEntregarLatLng, addressesReady, addDireccion } = useAddresses();

  const [clientReady, setClientReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    try {
      setOnboardingDone(sessionStorage.getItem(SESSION_KEY) === '1');
    } catch {
      setOnboardingDone(false);
    }
    setClientReady(true);
  }, []);

  const modoCliente = searchParams.get('modo') === 'cliente';
  const enHomeOExpress = pathname === '/' || pathname === '/express';
  const bloqueadoOperario = user ? isOperarioSinModoCliente(user.rol, modoCliente) : false;

  const shouldShow =
    clientReady &&
    !onboardingDone &&
    enHomeOExpress &&
    addressesReady &&
    !authLoading &&
    !bloqueadoOperario &&
    direccionEntregarLatLng === null;

  const handleFinish = useCallback(
    (payload: Parameters<typeof addDireccion>[0]) => {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
      addDireccion(payload);
      setOnboardingDone(true);
    },
    [addDireccion]
  );

  if (!shouldShow) return null;

  return (
    <LocationAddressFlow variant="onboarding" onFinish={handleFinish} stackClass="z-[60]" />
  );
}
