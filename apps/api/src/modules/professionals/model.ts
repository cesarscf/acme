import { trade, workStyle } from '@acme/db';
import { t } from 'elysia';

export const ProfessionalsModel = {
  'professionals.Changes': t.Partial(
    t.Object({
      name: t.String({ minLength: 1, maxLength: 80, pattern: '\\S' }),
      trades: t.Array(t.UnionEnum(trade.enumValues), { uniqueItems: true }),
      workStyle: t.Nullable(t.UnionEnum(workStyle.enumValues)),
    }),
  ),
};
