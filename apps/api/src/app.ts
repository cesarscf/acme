import { Elysia } from 'elysia';
import { health } from './modules/health';
import { whatsapp } from './modules/whatsapp';

export const app = new Elysia().use(health).use(whatsapp);

export type App = typeof app;
