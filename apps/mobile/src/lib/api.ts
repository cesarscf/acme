import type { App } from '@acme/api/app';
import { treaty } from '@elysia/eden';
import { fetch as expoFetch } from 'expo/fetch';
import { authClient } from './auth-client';
import { baseUrl } from './base-url';

export const api = treaty<App>(
  baseUrl,
  // The session cookie lives in SecureStore, so it is sent by hand; `include` would clash with it.
  {
    headers: async () => ({ cookie: await authClient.getCookie() }),
    fetch: { credentials: 'omit' },
    // React Native's fetch buffers the whole body; expo/fetch streams it, which the Assistant's replies need.
    fetcher: expoFetch as unknown as typeof fetch,
  },
);

export async function unwrap<T>(request: Promise<{ data: T; error: unknown }>) {
  const { data, error } = await request;
  if (error) throw error;
  return data as NonNullable<T>;
}
