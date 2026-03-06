import useSWR from 'swr';
import type { Local, MenuItem, Review } from '@/lib/data';

type LocalResponse = { local: Local; menu: MenuItem[]; reviews?: Review[] };

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
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
      revalidateOnFocus: true,
      dedupingInterval: 5000,
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
