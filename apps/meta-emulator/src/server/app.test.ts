import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './app';

test('GET /health answers ok', async () => {
  const app = createApp({ appSecret: 'secret', verifyToken: 'verify', webhookUrl: 'http://127.0.0.1:1/webhook' });
  const response = await app.handle(new Request('http://localhost/health'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});

async function appWithWeb() {
  const parent = await mkdtemp(path.join(tmpdir(), 'emulator-'));
  await writeFile(path.join(parent, 'secret.txt'), 'outside the web screen');
  const webDir = path.join(parent, 'web');
  await mkdir(path.join(webDir, 'assets'), { recursive: true });
  await writeFile(path.join(webDir, 'index.html'), '<div id="root"></div>');
  await writeFile(path.join(webDir, 'assets', 'main.js'), 'console.log("emulator")');
  return createApp({ appSecret: 'secret', verifyToken: 'verify', webhookUrl: 'http://127.0.0.1:1/webhook', webDir });
}

test('the built web screen is served from the root', async () => {
  const app = await appWithWeb();
  const response = await app.handle(new Request('http://localhost/'));
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('<div id="root"></div>');
});

test('the web screen assets are served by path', async () => {
  const app = await appWithWeb();
  const response = await app.handle(new Request('http://localhost/assets/main.js'));
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('console.log("emulator")');
});

test('the Graph API routes still answer when the web screen is served', async () => {
  const app = await appWithWeb();
  const response = await app.handle(new Request('http://localhost/health'));
  expect(await response.json()).toEqual({ status: 'ok' });
});

test('files outside the web screen folder are never served', async () => {
  const app = await appWithWeb();
  const response = await app.handle(new Request('http://localhost/..%2fsecret.txt'));
  expect(response.status).toBe(404);
});

test('a missing file is not found', async () => {
  const app = await appWithWeb();
  const response = await app.handle(new Request('http://localhost/assets/missing.js'));
  expect(response.status).toBe(404);
});
