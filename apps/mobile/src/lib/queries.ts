import { QueryClient, queryOptions } from '@tanstack/react-query';
import { api } from './api';

export const queryClient = new QueryClient();

export const meQuery = queryOptions({ queryKey: ['me'], queryFn: () => unwrap(api.me.get()) });

export const teamQuery = queryOptions({ queryKey: ['team'], queryFn: () => unwrap(api.team.get()) });

export const catalogQuery = queryOptions({
  queryKey: ['catalog'],
  queryFn: () => unwrap(api.catalog.get()),
  staleTime: Number.POSITIVE_INFINITY,
});

export type Professional = Awaited<ReturnType<typeof meQuery.queryFn & {}>>;
export type Assistant = Awaited<ReturnType<typeof teamQuery.queryFn & {}>>[number];
export type CatalogEntry = Awaited<ReturnType<typeof catalogQuery.queryFn & {}>>[number];
export type Trade = Professional['trades'][number];
export type WorkStyle = NonNullable<Professional['workStyle']>;
export type Role = Assistant['role'];

export async function unwrap<T>(request: Promise<{ data: T; error: unknown }>) {
  const { data, error } = await request;
  if (error) throw error;
  return data as NonNullable<T>;
}
