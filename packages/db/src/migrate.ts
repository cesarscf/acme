import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index';

// drizzle-kit is a dev dependency, so the deploy migrates with drizzle-orm's migrator (same migrations table).
await migrate(db, { migrationsFolder: path.resolve(import.meta.dir, '../drizzle') });
await db.$client.end();
