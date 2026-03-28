import useSWR from 'swr';
import type { Local, MenuItem, Review } from '@/lib/data';

type LocalResponse = { local: Local; menu: MenuItem[]; reviews?: Review[] };

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Error al cargar');
  }
  return res.json();
};

export function useLocal(localId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<LocalResponse | null>(
    localId ? `/api/locales/${localId}` : null,
    fetcher,
    {
      // revalidateOnFocus=false evita una lectura Firestore cada vez que el usuario
      // vuelve a la pestaña del restaurante; el menú es suficientemente estable.
      revalidateOnFocus: false,
      // 3 minutos: cualquier navegación de vuelta dentro de la ventana reutiliza la respuesta cacheada
      dedupingInterval: 180.000,
      keepPreviousData: true,
    }
  );
  return {
    local: data?.local ?? null,
    menu: data?.menu ?? [],
    reviews: data?.reviews ?? [],
    isLoading,
    error,
    mutate,
  };
}
