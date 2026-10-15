import { Elysia, status } from 'elysia';
import { auth as authServer } from './service';

export const auth = new Elysia({ name: 'auth' }).mount(authServer.handler).macro({
  auth: {
    async resolve({ request: { headers } }) {
      const session = await authServer.api.getSession({ headers });
      if (!session) throw status(401, 'Unauthorized');
      return { professional: session.user, session: session.session };
    },
  },
});
