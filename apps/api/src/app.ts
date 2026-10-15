import { Elysia } from 'elysia';
import { auth } from './modules/auth';
import { conversations } from './modules/conversations';
import { health } from './modules/health';
import { professionals } from './modules/professionals';
import { team } from './modules/team';
import { whatsapp } from './modules/whatsapp';

export const app = new Elysia().use(health).use(auth).use(whatsapp).use(professionals).use(team).use(conversations);

export type App = typeof app;
