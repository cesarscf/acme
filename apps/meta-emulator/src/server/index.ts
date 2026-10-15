import { createApp } from './app';

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const app = createApp({
  appSecret: env('META_APP_SECRET'),
  verifyToken: env('META_VERIFY_TOKEN'),
  webhookUrl: env('META_WEBHOOK_URL'),
});

app.listen(Number(process.env.PORT ?? 4000));

console.log(`Meta Emulator on http://${app.server?.hostname}:${app.server?.port}`);
