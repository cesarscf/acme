import { Elysia } from 'elysia';
import { auth } from '../auth';
import { ProfessionalsModel } from './model';
import { getProfessional, updateProfessional } from './service';

export const professionals = new Elysia()
  .use(auth)
  .model(ProfessionalsModel)
  .get('/me', ({ professional }) => getProfessional(professional.id), { auth: true })
  .patch('/me', ({ professional, body }) => updateProfessional(professional.id, body), {
    auth: true,
    body: 'professionals.Changes',
  });
