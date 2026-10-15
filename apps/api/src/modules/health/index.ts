import { Elysia } from 'elysia';
import { HealthModel } from './model';

export const health = new Elysia()
  .model(HealthModel)
  .get('/health', () => ({ status: 'ok' as const }), { response: 'health.Status' });
