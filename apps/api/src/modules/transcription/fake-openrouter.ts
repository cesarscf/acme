// Test-only stand-in for OpenRouter's transcription endpoint: answers each request with the next scripted reply.
export function startFakeOpenRouter() {
  const replies: Response[] = [];
  const requests: Awaited<ReturnType<Request['formData']>>[] = [];

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname !== '/audio/transcriptions') return new Response('Not found', { status: 404 });
      requests.push(await request.formData());
      return replies.shift() ?? Response.json({ error: { message: 'No reply scripted' } }, { status: 500 });
    },
  });

  process.env.OPENROUTER_BASE_URL = `http://localhost:${server.port}`;
  process.env.OPENROUTER_API_KEY = 'test-key';

  return {
    requests,
    transcribe(text: string, seconds = 4.2) {
      replies.push(Response.json({ text, usage: { seconds, cost: 0.00001 } }));
    },
    fail(status = 502) {
      replies.push(Response.json({ error: { message: 'Provider unavailable' } }, { status }));
    },
    stop: () => server.stop(true),
  };
}
