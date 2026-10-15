import { Elysia } from 'elysia';
import { auth } from './modules/auth';
import { briefing } from './modules/briefing';
import { conversations } from './modules/conversations';
import { customers } from './modules/customers';
import { health } from './modules/health';
import { professionals } from './modules/professionals';
import { team } from './modules/team';
import { whatsapp } from './modules/whatsapp';

export const app = new Elysia()
  .use(health)
  .use(auth)
  .use(whatsapp)
  .use(professionals)
  .use(team)
  .use(briefing)
  .use(customers)
  .use(conversations);

export type App = typeof app;
