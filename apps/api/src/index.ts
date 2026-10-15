import { app } from './app';

app.listen(Number(process.env.PORT ?? 3000));

console.log(`API on http://${app.server?.hostname}:${app.server?.port}`);
