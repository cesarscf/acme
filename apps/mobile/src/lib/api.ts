import type { App } from '@acme/api/app';
import { treaty } from '@elysia/eden';
import { authClient } from './auth-client';
import { baseUrl } from './base-url';

export const api = treaty<App>(
  baseUrl,
  // The session cookie lives in SecureStore, so it is sent by hand; `include` would clash with it.
  { headers: async () => ({ cookie: await authClient.getCookie() }), fetch: { credentials: 'omit' } },
);

export async function unwrap<T>(request: Promise<{ data: T; error: unknown }>) {
  const { data, error } = await request;
  if (error) throw error;
  return data as NonNullable<T>;
}
