import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { catalogKeys } from './keys';

function getCatalog() {
  return unwrap(api.catalog.get());
}

export type CatalogEntry = Awaited<ReturnType<typeof getCatalog>>[number];

export function useCatalogQuery() {
  return useQuery({ queryKey: catalogKeys.all, queryFn: getCatalog, staleTime: Number.POSITIVE_INFINITY });
}
