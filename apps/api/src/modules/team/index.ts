import { Elysia, status } from 'elysia';
import { auth } from '../auth';
import { catalog } from './catalog';
import { TeamModel } from './model';
import { chooseRoles, listTeam, renameAssistant } from './service';

export const team = new Elysia()
  .use(auth)
  .model(TeamModel)
  .get('/catalog', () => catalog)
  .get('/team', ({ professional }) => listTeam(professional.id), { auth: true })
  .post('/team', ({ professional, body: { roles } }) => chooseRoles(professional.id, roles), {
    auth: true,
    body: 'team.Choice',
  })
  .patch(
    '/team/:id',
    async ({ professional, params: { id }, body: { name } }) => {
      if (!(await renameAssistant(professional.id, id, name))) throw status(404, 'Assistant not found');
    },
    { auth: true, params: 'team.Assistant', body: 'team.Rename' },
  );
