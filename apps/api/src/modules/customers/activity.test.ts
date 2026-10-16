import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { startFakeClaude } from '../conversations/fake-claude';
import { addDays, localDate } from '../time/time';
import { createVisit, ensureVisitConfirmationTemplate, requestDueVisitConfirmations } from '../visits/service';
import { createCustomer } from './service';

const api = treaty(app);
const claude = startFakeClaude();
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: 'http://localhost:0/webhooks/whatsapp',
}).listen(0);
const timeZone = 'America/Sao_Paulo';

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureVisitConfirmationTemplate();
});

afterAll(async () => {
  claude.stop();
  await emulator.stop();
});

async function liaAndJoao() {
  const { professional, headers } = await signInNewProfessional();
  await api.me['ai-consent'].post(undefined, { headers });
  await api.team.post({ roles: ['scheduling'] }, { headers });
  const { data: team } = await api.team.get({ headers });
  const lia = team![0]!;
  const phoneNumber = `55119${String(randomInt(1e8)).padStart(8, '0')}`;
  const { customer: joao } = await createCustomer(professional.id, { name: 'João Pereira', phoneNumber });
  const chat = async () => (await api.team({ id: lia.id }).messages.get({ headers })).data!.items;
  const thread = async () => (await api.customers({ id: joao.id }).thread.get({ headers })).data!.items;
  return { professional, headers, lia, joao, chat, thread };
}

async function drain(request: Promise<{ data: AsyncIterable<unknown> | null; error: unknown }>) {
  const { data, error } = await request;
  expect(error).toBeNull();
  for await (const _ of data!);
}

const liaAsks =
  'Terminou a visita do João? Me conte como foi: o que você viu, o que fez e o que vem agora. Se precisar de orçamento, eu chamo a Olga.';

test("the Lia's message in João's thread shows in her chat as an activity card pointing at that message", async () => {
  const { headers, lia, joao, chat, thread } = await liaAndJoao();
  claude.reply({ content: [{ type: 'text', text: liaAsks }] });

  await drain(
    api.customers({ id: joao.id }).messages.post({ text: 'Como ficou a visita?', role: 'scheduling' }, { headers }),
  );

  const message = (await thread()).find((item) => item.type === 'assistant' && item.text === liaAsks)!;
  expect(await chat()).toEqual([
    {
      id: `activity:${message.id}`,
      type: 'activity',
      customer: { id: joao.id, name: 'João Pereira' },
      itemId: message.id,
      text: liaAsks,
      at: expect.any(Date),
    },
  ]);
  // What the Professional wrote in the thread is not the Lia's activity.
  const { data: team } = await api.team.get({ headers });
  expect(team!.find(({ id }) => id === lia.id)!.lastMessage).toMatchObject({ from: 'assistant', text: liaAsks });
});

test("a Routine's notice about João shows in his thread and as an activity card in the Lia's chat", async () => {
  const { professional, joao, chat, thread } = await liaAndJoao();
  const tomorrow = addDays(localDate(new Date(), timeZone), 1);
  await createVisit(professional.id, joao.id, {
    scheduledAt: new Date(`${tomorrow}T12:00:00Z`),
    durationMinutes: 60,
  });

  await requestDueVisitConfirmations({ id: professional.id, name: 'Carlos', timezone: timeZone }, tomorrow);

  const notice = (await thread()).find((item) => item.type === 'notice')!;
  expect(notice.text).toMatch(/^Rotina: pedi para João Pereira confirmar a visita de .+\.$/);
  expect(await chat()).toEqual([
    expect.objectContaining({
      type: 'activity',
      itemId: notice.id,
      text: notice.text,
      customer: expect.objectContaining({ id: joao.id }),
    }),
  ]);
});
