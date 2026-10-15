import Constants from 'expo-constants';
import { apiUrl } from './api-url';

export const baseUrl = apiUrl({ explicit: process.env.EXPO_PUBLIC_API_URL, metroHost: Constants.expoConfig?.hostUri });
