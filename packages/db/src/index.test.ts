import { expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { db } from './index';

test('connects to Postgres', async () => {
  const [row] = await db.execute<{ answer: number }>(sql`select 1 as answer`);
  expect(row?.answer).toBe(1);
});
