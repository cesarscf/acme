import { assistantRole } from '@acme/db';
import { t } from 'elysia';

const assistantName = t.String({ minLength: 1, maxLength: 40, pattern: '\\S' });

export const TeamModel = {
  'team.Choice': t.Object({
    roles: t.Array(t.UnionEnum(assistantRole.enumValues), { minItems: 1, uniqueItems: true }),
  }),
  'team.Assistant': t.Object({ id: t.String({ format: 'uuid' }) }),
  'team.Rename': t.Object({ name: assistantName }),
};
