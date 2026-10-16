import { Elysia } from 'elysia';
import { auth } from '../auth';
import { VisitsModel } from './model';
import { requestVisitConfirmations } from './service';

export const visits = new Elysia()
  .use(auth)
  .model(VisitsModel)
  .post(
    '/visits/confirmations',
    ({ professional, body: { visitIds } }) => requestVisitConfirmations(professional.id, visitIds),
    { auth: true, body: 'visits.Confirmations' },
  );
