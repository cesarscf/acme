import path from 'node:path';
import { Elysia, status } from 'elysia';

// Serves the built web screen (vite build) when webDir is given.
export const web = (webDir: string | undefined) => {
  const plugin = new Elysia();
  if (!webDir) return plugin;
  const root = path.resolve(webDir);
  return plugin.get('/*', async ({ params }) => {
    const filePath = path.resolve(root, decodeURIComponent(params['*']) || 'index.html');
    const file = Bun.file(filePath);
    if (!filePath.startsWith(`${root}${path.sep}`) || !(await file.exists())) throw status(404, 'Not Found');
    return file;
  });
};
