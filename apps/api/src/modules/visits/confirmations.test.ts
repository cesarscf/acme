import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { db, visits } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { createCustomer } from '../customers/service';
import { addDays, localDate, toInstant } from '../time/time';
import { listMessages } from '../whatsapp/service';
import { createVisit, ensureVisitConfirmationTemplate } from './service';

const api = treaty(app);
app.listen(0);
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: `http://localhost:${app.server!.port}/webhooks/whatsapp`,
}).listen(0);
const meta = treaty(emulator, { headers: { authorization: 'Bearer token' } });
const platformNumber = process.env.META_PLATFORM_PHONE_NUMBER_ID!;
const timeZone = 'America/Sao_Paulo';

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureVisitConfirmationTemplate();
});

afterAll(async () => {
  await emulator.stop();
  await app.stop();
});

// Late hours keep today's Visits ahead whenever the test runs; past 22:00 there is no "later today" left.
const later = (time: string) => toInstant(localDate(new Date(), timeZone), time, timeZone);

async function professionalWithDay() {
  const { professional, headers } = await signInNewProfessional();
  await api.team.post({ roles: ['scheduling'] }, { headers });
  const customer = async (name: string) =>
    (
      await createCustomer(professional.id, {
        name,
        phoneNumber: `55119${String(randomInt(1e8)).padStart(8, '0')}`,
      })
    ).customer;
  const visit = (customerId: string, scheduledAt: Date) =>
    createVisit(professional.id, customerId, { scheduledAt, durationMinutes: 30 }, 'Limpeza de split');
  const today = async () => {
    const { data } = await api.customers.get({ query: {}, headers });
    return data!.sections.find(({ key }) => key === 'today');
  };
  return { professionalId: professional.id, headers, customer, visit, today };
}

test('Hoje offers "Pedir confirmação" with a card listing who has not confirmed, one row per Customer', async () => {
  const { customer, visit, today } = await professionalWithDay();
  const joao = await customer('João Pereira');
  const marta = await customer('Marta Lima');
  const ana = await customer('Ana Souza');
  const joaos = await visit(joao.id, later('23:00'));
  await visit(joao.id, later('23:30'));
  const martas = await visit(marta.id, later('22:30'));
  const anas = await visit(ana.id, later('23:00'));
  await db.update(visits).set({ status: 'confirmed' }).where(eq(visits.id, anas.id));

  const section = await today();

  expect(section!.confirmation).toEqual({
    visitIds: [martas.id, joaos.id],
    card: {
      title: 'Para confirmar: pedir a confirmação de hoje',
      subtitle: '2 clientes',
      rows: [
        { label: '22:30', value: 'Marta Lima' },
        { label: '23:00', value: 'João Pereira' },
      ],
      notices: [
        'Nada é enviado agora.',
        'Depois que você confirmar, cada cliente recebe uma mensagem no WhatsApp com os botões Confirmar e Remarcar.',
      ],
      question: 'Confirma: pedir a confirmação de 2 clientes?',
    },
  });
});

test('without a Visit today waiting for confirmation there is no "Pedir confirmação"', async () => {
  const { customer, visit, today } = await professionalWithDay();
  const joao = await customer('João Pereira');
  await visit(joao.id, toInstant(addDays(localDate(new Date(), timeZone), 1), '09:00', timeZone));

  expect(await today()).toBeUndefined();

  const marta = await customer('Marta Lima');
  const martas = await visit(marta.id, later('23:00'));
  await db.update(visits).set({ status: 'confirmed' }).where(eq(visits.id, martas.id));
  expect((await today())!.confirmation).toBeNull();
});

test('Confirmar sends each Customer one message, the rows show "Enviado agora", then "Confirmado" as they answer', async () => {
  const { headers, customer, visit, today } = await professionalWithDay();
  const joao = await customer('João Pereira');
  const marta = await customer('Marta Lima');
  await visit(joao.id, later('23:00'));
  await visit(joao.id, later('23:30'));
  await visit(marta.id, later('22:30'));
  expect(await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber })).toEqual([]);
  const { visitIds } = (await today())!.confirmation!;

  const { data, status } = await api.visits.confirmations.post({ visitIds }, { headers });

  expect(status).toBe(200);
  expect(data).toEqual({ sent: 2 });
  const toJoao = await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber });
  expect(toJoao).toHaveLength(1);
  expect(await listMessages({ phoneNumberId: platformNumber, waId: marta.phoneNumber })).toHaveLength(1);
  const after = await today();
  expect(after!.rows.map(({ status }) => status?.label)).toEqual(['Enviado agora', 'Enviado agora']);

  await meta.emulator.messages({ id: toJoao[0]!.wamid }).click.post({ index: 0 });

  const answered = await today();
  expect(answered!.rows.find(({ name }) => name === 'João Pereira')!.status).toMatchObject({ label: 'Confirmado' });
  // João confirmed the Visit he was asked about; his later one today has still to be asked.
  expect(answered!.confirmation!.card.rows).toEqual([
    { label: '22:30', value: 'Marta Lima' },
    { label: '23:30', value: 'João Pereira' },
  ]);
});

test('Visits of another Professional, or already past, are not asked', async () => {
  const { headers, customer, visit } = await professionalWithDay();
  const joao = await customer('João Pereira');
  const joaos = await visit(joao.id, later('23:00'));
  const past = await visit(joao.id, toInstant(addDays(localDate(new Date(), timeZone), -1), '09:00', timeZone));
  const other = await professionalWithDay();

  const stranger = await api.visits.confirmations.post({ visitIds: [joaos.id] }, { headers: other.headers });
  const before = await api.visits.confirmations.post({ visitIds: [past.id] }, { headers });

  expect(stranger.data).toEqual({ sent: 0 });
  expect(before.data).toEqual({ sent: 0 });
  expect(await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber })).toEqual([]);
});

test('a Visit already started today is not offered for confirmation, since asking would send nothing', async () => {
  const { customer, visit, today } = await professionalWithDay();
  const joao = await customer('João Pereira');
  // Started ten minutes ago and still going (30 minutes long).
  await visit(joao.id, new Date(Date.now() - 10 * 60_000));

  expect((await today())?.confirmation ?? null).toBeNull();
});
