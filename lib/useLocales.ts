import useSWR from 'swr';
import type { Local } from '@/lib/data';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al cargar');
  return res.json();
};

export function useLocales(incluirSuspendidos = false) {
  const url = incluirSuspendidos ? '/api/locales?incluirSuspendidos=1' : '/api/locales';
  const { data, error, isLoading, mutate } = useSWR<{ locales: Local[] }>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30000, // 30s - evita refetch duplicados
    revalidateIfStale: true,
    keepPreviousData: true,
  });
  return {
    locales: data?.locales ?? [],
    isLoading,
    error,
    mutate,
  };
}
