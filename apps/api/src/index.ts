import { app } from './app';
import { ensureLoginCodeTemplate } from './modules/auth/service';
import { ensureQuoteTemplates } from './modules/quotes/service';
import { startRoutines } from './modules/routines/service';
import { ensureVisitConfirmationTemplate } from './modules/visits/service';

// Before listening, so no request starts the Routines' pg-boss on its own.
await startRoutines();
app.listen(Number(process.env.PORT ?? 3000));

console.log(`API on http://${app.server?.hostname}:${app.server?.port}`);

// In dev the Meta Emulator may start after the API and keeps templates only in memory, so this retries until it answers.
for (;;) {
  try {
    await ensureLoginCodeTemplate();
    await ensureVisitConfirmationTemplate();
    await ensureQuoteTemplates();
    break;
  } catch (error) {
    console.warn(`Could not ensure the WhatsApp templates, retrying in 5s: ${(error as Error).message}`);
    await Bun.sleep(5000);
  }
}
