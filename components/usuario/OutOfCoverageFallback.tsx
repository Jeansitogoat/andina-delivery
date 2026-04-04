'use client';

import { MapPinOff } from 'lucide-react';

export const ANDINA_OPEN_ADDRESS_SELECTOR_EVENT = 'andina-open-address-selector';

export function dispatchOpenAddressSelector() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ANDINA_OPEN_ADDRESS_SELECTOR_EVENT));
}

export default function OutOfCoverageFallback() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100">
        <MapPinOff className="h-12 w-12" strokeWidth={1.5} aria-hidden />
      </div>
      <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
        ¡Ups! Aún no llegamos hasta aquí 🛵
      </h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-600">
        Tu dirección guardada queda fuera de nuestra zona de entrega. Cambia a una
        ubicación dentro del área para ver restaurantes y pedir.
      </p>
      <button
        type="button"
        onClick={() => dispatchOpenAddressSelector()}
        className="btn-primary-ui mt-8 rounded-full px-8 py-3.5 text-[15px] shadow-lg"
      >
        📍 Cambiar dirección
      </button>
    </div>
  );
}
