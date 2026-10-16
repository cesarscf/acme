import { afterAll, expect, test } from 'bun:test';
import { randomInt, randomUUID } from 'node:crypto';
import { db, visits } from '@acme/db';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { startFakeClaude } from '../conversations/fake-claude';
import { createCustomer } from '../customers/service';
import { addDays, localDate, toInstant } from '../time/time';
import { createVisit } from './service';

const api = treaty(app);
const claude = startFakeClaude();
const timeZone = 'America/Sao_Paulo';
const today = () => localDate(new Date(), timeZone);

afterAll(() => claude.stop());

// The Monday after this week, as "da semana que vem" says it.
function nextMonday() {
  let day = addDays(today(), 1);
  while (new Date(`${day}T12:00:00Z`).getUTCDay() !== 1) day = addDays(day, 1);
  return day;
}

async function liasDay() {
  const { professional, headers } = await signInNewProfessional();
  await api.me['ai-consent'].post(undefined, { headers });
  await api.team.post({ roles: ['scheduling'] }, { headers });
  const { data: team } = await api.team.get({ headers });
  const lia = team![0]!;
  const customer = async (name: string) =>
    (
      await createCustomer(professional.id, {
        name,
        phoneNumber: `55119${String(randomInt(1e8)).padStart(8, '0')}`,
      })
    ).customer;
  const visit = async (customerId: string, day: string, time: string, title: string) =>
    createVisit(
      professional.id,
      customerId,
      { scheduledAt: toInstant(day, time, timeZone), durationMinutes: 60 },
      title,
    );
  const ask = async (text: string, from: string, to: string) => {
    claude.reply(
      { content: [{ type: 'tool_use', id: `toolu_${randomUUID()}`, name: 'listVisits', input: { from, to } }] },
      { content: [{ type: 'text', text: 'Aqui está.' }] },
    );
    const { data } = await api.team({ id: lia.id }).messages.post({ text }, { headers });
    for await (const _ of data!);
    const { data: chat } = await api.team({ id: lia.id }).messages.get({ headers });
    return chat!.items.findLast((item) => item.type === 'agenda');
  };
  return { professional, headers, customer, visit, ask };
}

test('"@agenda da semana que vem" shows the Agenda card of the period Claude read, with day and time on each row', async () => {
  const { customer, visit, ask } = await liasDay();
  const monday = nextMonday();
  const friday = addDays(monday, 4);
  const joao = await customer('João Pereira');
  const marta = await customer('Marta Lima');
  const joaos = await visit(joao.id, addDays(monday, 2), '08:00', 'Ar da sala não gela');
  const martas = await visit(marta.id, monday, '14:00', 'Limpeza de split');
  await visit(marta.id, addDays(friday, 3), '09:00', 'Fora do período');

  const card = await ask('@agenda da semana que vem', monday, friday);

  expect(card).toMatchObject({
    type: 'agenda',
    title: 'Agenda',
    subtitle: expect.stringMatching(
      /^Semana que vem, \d\d? a \d\d? \w+ · 2 visitas$|^Semana que vem, \d\d? \w+ a \d\d? \w+ · 2 visitas$/,
    ),
    rows: [
      {
        visitId: martas.id,
        customerId: marta.id,
        customerName: 'Marta Lima',
        when: 'Seg',
        detail: '14:00 · Limpeza de split',
        status: { label: 'Não enviado', tone: 'none' },
      },
      {
        visitId: joaos.id,
        customerId: joao.id,
        customerName: 'João Pereira',
        when: 'Qua',
        detail: '08:00 · Ar da sala não gela',
        status: { label: 'Não enviado', tone: 'none' },
      },
    ],
    confirmation: { visitIds: [martas.id, joaos.id] },
  });
});

test('"@agenda de amanhã" shows only the hour on each row, and no "Pedir confirmação" once everyone confirmed', async () => {
  const { customer, visit, ask } = await liasDay();
  const tomorrow = addDays(today(), 1);
  const joao = await customer('João Pereira');
  const joaos = await visit(joao.id, tomorrow, '09:00', 'Ar da sala não gela');
  await db.update(visits).set({ status: 'confirmed' }).where(eq(visits.id, joaos.id));

  const card = await ask('@agenda de amanhã', tomorrow, tomorrow);

  expect(card).toMatchObject({
    subtitle: expect.stringMatching(/^Amanhã, \d\d? \w+ · 1 visita$/),
    rows: [{ when: '09:00', customerName: 'João Pereira', status: { label: 'Confirmado' } }],
    confirmation: null,
  });
});

test('an empty day says so, and listing Visits without @agenda shows no card', async () => {
  const { ask } = await liasDay();

  const empty = await ask('@agenda', today(), today());
  const plain = await ask('Tenho algo amanhã?', addDays(today(), 1), addDays(today(), 1));

  expect(empty).toMatchObject({ subtitle: expect.stringMatching(/^Hoje, \d\d? \w+ · Nenhuma visita$/), rows: [] });
  // The card from the first message is still the last one: the second asked without @agenda.
  expect(plain).toEqual(empty);
});
