import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export default defineConfig({
  out: './drizzle',
  schema: './src/schema.ts',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: { url },
});
