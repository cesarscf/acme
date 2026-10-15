import { app } from './app';

app.listen(Number(process.env.PORT ?? 4000));

console.log(`Meta Emulator on http://${app.server?.hostname}:${app.server?.port}`);
