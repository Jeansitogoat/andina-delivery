'use client';

import { useEffect } from 'react';
import { useFullScreenModal } from '@/lib/FullScreenModalContext';
import type { DireccionGuardada } from './SeccionDirecciones';
import LocationAddressFlow from '@/components/LocationAddressFlow';

type Props = {
  onClose: () => void;
  onGuardar: (_d: Omit<DireccionGuardada, 'id'>) => void;
  telefonoUsuario?: string | null;
  /** Reservado por si en el futuro se precarga el mapa */
  initialLatLng?: { lat: number; lng: number } | null;
};

/**
 * Mismo flujo visual que el onboarding de ubicación (búsqueda + mapa + referencia).
 */
export default function AgregarDireccionModal({ onClose, onGuardar, telefonoUsuario }: Props) {
  const { register, unregister } = useFullScreenModal();
  useEffect(() => {
    register();
    return () => unregister();
  }, [register, unregister]);

  return (
    <LocationAddressFlow
      variant="add"
      stackClass="z-[50]"
      telefonoUsuario={telefonoUsuario}
      onFinish={(payload) => {
        onGuardar(payload);
        onClose();
      }}
      onCancel={onClose}
    />
  );
}
