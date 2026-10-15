import { expoClient } from '@better-auth/expo/client';
import { phoneNumberClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { baseUrl } from './base-url';

export const authClient = createAuthClient({
  baseURL: baseUrl,
  plugins: [expoClient({ scheme: 'acme', storagePrefix: 'acme', storage: SecureStore }), phoneNumberClient()],
});
