'use client';

import { useCallback, useMemo } from 'react';
import { useAddresses } from '@/lib/addressesContext';
import type { DireccionGuardada } from '@/components/usuario/SeccionDirecciones';

type EtiquetaFavorito = DireccionGuardada['etiqueta'];

function pickFavorite(dirs: DireccionGuardada[], etiqueta: EtiquetaFavorito): DireccionGuardada | null {
  const matches = dirs.filter((d) => d.etiqueta === etiqueta);
  if (matches.length === 0) return null;
  return matches.find((d) => d.principal) ?? matches[0];
}

export function useSavedAddresses() {
  const { direcciones, updateDirecciones, setSelectedId } = useAddresses();

  const favorites = useMemo(() => {
    const casa = pickFavorite(direcciones, 'casa');
    const trabajo = pickFavorite(direcciones, 'trabajo');
    const otro = pickFavorite(direcciones, 'otro');
    return { casa, trabajo, otro };
  }, [direcciones]);

  const upsertFavorite = useCallback(
    (params: {
      etiqueta: EtiquetaFavorito;
      nombre: string;
      detalle: string;
      referencia?: string;
      lat?: number | null;
      lng?: number | null;
    }) => {
      const { etiqueta, nombre, detalle, referencia, lat, lng } = params;
      const idFallback = `dir-${Date.now()}`;
      const existing = pickFavorite(direcciones, etiqueta);
      const id = existing?.id ?? idFallback;

      const next: DireccionGuardada[] = (() => {
        const base = direcciones.slice();
        const updated: DireccionGuardada = {
          id,
          etiqueta,
          nombre: nombre.trim(),
          detalle: detalle.trim(),
          referencia: referencia?.trim() ? referencia.trim() : undefined,
          lat: typeof lat === 'number' && !Number.isNaN(lat) ? lat : undefined,
          lng: typeof lng === 'number' && !Number.isNaN(lng) ? lng : undefined,
          principal: true,
        };

        if (existing) {
          // Reemplazo del favorito existente para mantener “memoria” de Casa/Trabajo/Otro como 1 entidad por tipo.
          return base.map((d) => (d.id === existing.id ? { ...updated } : d.id === id ? { ...updated } : d));
        }

        // Insertamos como favorito nuevo.
        return [...base.map((d) => ({ ...d, principal: false })), updated];
      })();

      // Forzar principal = true al guardar favorito y poner false en el resto.
      const normalized = next.map((d) => ({ ...d, principal: d.id === id ? true : false }));

      updateDirecciones(normalized);
      setSelectedId(id);
      return id;
    },
    [direcciones, setSelectedId, updateDirecciones]
  );

  return { favorites, upsertFavorite };
}

