import type Anthropic from '@anthropic-ai/sdk';

type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

export type ScriptedReply = {
  content: Block[];
  stop_reason?: Anthropic.Beta.BetaStopReason;
  model?: string;
  usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
};

// Test-only stand-in for the Messages API: answers each request with the next scripted reply, streamed as SSE.
export function startFakeClaude() {
  const replies: ScriptedReply[] = [];
  const requests: Anthropic.Beta.MessageCreateParams[] = [];
  const headers: Headers[] = [];

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname !== '/v1/messages') return new Response('Not found', { status: 404 });
      const body = (await request.json()) as Anthropic.Beta.MessageCreateParams;
      requests.push(body);
      headers.push(request.headers);
      const reply = replies.shift();
      if (!reply)
        return Response.json(
          { type: 'error', error: { type: 'api_error', message: 'No reply scripted' } },
          { status: 500 },
        );
      return new Response(sse(reply, body.model), { headers: { 'content-type': 'text/event-stream' } });
    },
  });

  process.env.ANTHROPIC_BASE_URL = `http://localhost:${server.port}`;
  process.env.ANTHROPIC_API_KEY = 'test-key';

  return {
    requests,
    headers,
    reply(...scripted: ScriptedReply[]) {
      replies.push(...scripted);
    },
    stop: () => server.stop(true),
  };
}

function sse({ content, stop_reason, model, usage }: ScriptedReply, requested: string) {
  const tokens = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, ...usage };
  const events: [string, object][] = [
    [
      'message_start',
      {
        type: 'message_start',
        message: {
          id: `msg_${crypto.randomUUID()}`,
          type: 'message',
          role: 'assistant',
          model: model ?? requested,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { ...tokens, output_tokens: 1, cache_creation_input_tokens: 0 },
        },
      },
    ],
  ];
  content.forEach((block, index) => {
    if (block.type === 'text') {
      events.push([
        'content_block_start',
        { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
      ]);
      events.push([
        'content_block_delta',
        { type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } },
      ]);
    } else {
      events.push([
        'content_block_start',
        { type: 'content_block_start', index, content_block: { ...block, input: {} } },
      ]);
      events.push([
        'content_block_delta',
        {
          type: 'content_block_delta',
          index,
          delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) },
        },
      ]);
    }
    events.push(['content_block_stop', { type: 'content_block_stop', index }]);
  });
  const stopReason = stop_reason ?? (content.some(({ type }) => type === 'tool_use') ? 'tool_use' : 'end_turn');
  events.push([
    'message_delta',
    {
      type: 'message_delta',
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { ...tokens, cache_creation_input_tokens: 0 },
    },
  ]);
  events.push(['message_stop', { type: 'message_stop' }]);
  return events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
}
