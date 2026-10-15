import { Elysia } from 'elysia';
import { auth } from './modules/auth';
import { health } from './modules/health';
import { whatsapp } from './modules/whatsapp';

export const app = new Elysia().use(health).use(auth).use(whatsapp);

export type App = typeof app;
