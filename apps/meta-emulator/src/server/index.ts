import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app';

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const webDir = path.resolve(import.meta.dir, '../../dist');

const app = createApp({
  appSecret: env('META_APP_SECRET'),
  verifyToken: env('META_VERIFY_TOKEN'),
  webhookUrl: env('META_WEBHOOK_URL'),
  // Only after `bun run build`, as in the deploy; in dev Vite serves the web screen.
  webDir: existsSync(webDir) ? webDir : undefined,
});

// :: also accepts IPv4; Railway's private network may be IPv6 only.
app.listen({ port: Number(process.env.PORT ?? 4000), hostname: '::' });

console.log(`Meta Emulator on http://localhost:${app.server?.port}`);
