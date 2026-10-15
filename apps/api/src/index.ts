import { app } from './app';
import { ensureLoginCodeTemplate } from './modules/auth/service';

app.listen(Number(process.env.PORT ?? 3000));

console.log(`API on http://${app.server?.hostname}:${app.server?.port}`);

// In dev the Meta Emulator may start after the API and keeps templates only in memory, so this retries until it answers.
for (;;) {
  try {
    await ensureLoginCodeTemplate();
    break;
  } catch (error) {
    console.warn(`Could not ensure the login code template, retrying in 5s: ${(error as Error).message}`);
    await Bun.sleep(5000);
  }
}
