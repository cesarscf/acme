import type { App } from '@acme/api/app';
import { treaty } from '@elysia/eden';
import Constants from 'expo-constants';
import { apiUrl } from './api-url';

export const api = treaty<App>(
  apiUrl({ explicit: process.env.EXPO_PUBLIC_API_URL, metroHost: Constants.expoConfig?.hostUri }),
);
