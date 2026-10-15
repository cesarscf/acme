import { expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { db, visits } from '@acme/db';
import { eq } from 'drizzle-orm';
import type { Assistant } from '../conversations/service';
import { newAssistant, runTool } from '../conversations/test-tools';
import { customerTools } from '../customers/tools';
import { localDate } from './time';
import { visitTools } from './tools';

function newPhoneNumber() {
  return `55119${String(randomInt(1e8)).padStart(8, '0')}`;
}

function inDays(days: number) {
  return localDate(new Date(Date.now() + days * 86_400_000), 'America/Sao_Paulo');
}

async function newCustomer(schedulingAssistant: Assistant, name = 'João Pereira') {
  const { text } = await runTool(customerTools(schedulingAssistant), 'createCustomer', {
    name,
    phoneNumber: newPhoneNumber(),
  });
  return JSON.parse(text.slice(text.indexOf('{'))) as { id: string; name: string };
}

async function createVisit(
  schedulingAssistant: Assistant,
  input: Partial<Record<string, unknown>> & { customerId: string },
) {
  return runTool(visitTools(schedulingAssistant), 'createVisit', {
    date: inDays(1),
    time: '14:00',
    durationMinutes: null,
    allowConflict: false,
    ...input,
  });
}

async function visitsOf(schedulingAssistant: Assistant) {
  return db.select().from(visits).where(eq(visits.professionalId, schedulingAssistant.professional.id));
}

test('createVisit books the Customer at the local time, one hour long by default', async () => {
  const schedulingAssistant = await newAssistant();
  const joao = await newCustomer(schedulingAssistant);

  const { text, isError } = await createVisit(schedulingAssistant, {
    customerId: joao.id,
    date: '2099-10-16',
    time: '14:00',
  });

  expect(isError).toBe(false);
  expect(text).toContain('João Pereira');
  expect(text).toContain('16/10, às 14:00');
  expect(await visitsOf(schedulingAssistant)).toEqual([
    expect.objectContaining({
      customerId: joao.id,
      scheduledAt: new Date('2099-10-16T17:00:00Z'),
      durationMinutes: 60,
      status: 'scheduled',
    }),
  ]);
});

test('createVisit at a time taken by another Visit warns about the conflict and books nothing', async () => {
  const schedulingAssistant = await newAssistant();
  const joao = await newCustomer(schedulingAssistant);
  const marta = await newCustomer(schedulingAssistant, 'Marta Lima');
  await createVisit(schedulingAssistant, { customerId: joao.id, time: '14:00' });

  const { text, isError } = await createVisit(schedulingAssistant, { customerId: marta.id, time: '14:30' });

  expect(isError).toBe(false);
  expect(text).toContain('conflito');
  expect(text).toContain('João Pereira');
  expect(await visitsOf(schedulingAssistant)).toHaveLength(1);
});

test('createVisit books over a conflict once the Professional says so', async () => {
  const schedulingAssistant = await newAssistant();
  const joao = await newCustomer(schedulingAssistant);
  const marta = await newCustomer(schedulingAssistant, 'Marta Lima');
  await createVisit(schedulingAssistant, { customerId: joao.id, time: '14:00' });

  await createVisit(schedulingAssistant, { customerId: marta.id, time: '14:00', allowConflict: true });

  expect(await visitsOf(schedulingAssistant)).toHaveLength(2);
});

test('a Visit that ends when the next one starts is not a conflict', async () => {
  const schedulingAssistant = await newAssistant();
  const joao = await newCustomer(schedulingAssistant);
  await createVisit(schedulingAssistant, { customerId: joao.id, time: '14:00', durationMinutes: 90 });

  const { text } = await createVisit(schedulingAssistant, { customerId: joao.id, time: '15:30' });

  expect(text).not.toContain('conflito');
  expect(await visitsOf(schedulingAssistant)).toHaveLength(2);
});

test("createVisit refuses another Professional's Customer and a time in the past", async () => {
  const schedulingAssistant = await newAssistant();
  const someoneElse = await newCustomer(await newAssistant());
  const joao = await newCustomer(schedulingAssistant);

  const foreign = await createVisit(schedulingAssistant, { customerId: someoneElse.id });
  const past = await createVisit(schedulingAssistant, { customerId: joao.id, date: inDays(-1) });

  expect(foreign.isError).toBe(true);
  expect(past.isError).toBe(true);
  expect(await visitsOf(schedulingAssistant)).toEqual([]);
});

test('listVisits shows the Visits between two local dates, without the cancelled ones', async () => {
  const schedulingAssistant = await newAssistant();
  const joao = await newCustomer(schedulingAssistant);
  const marta = await newCustomer(schedulingAssistant, 'Marta Lima');
  await createVisit(schedulingAssistant, { customerId: joao.id, date: inDays(1), time: '09:00' });
  await createVisit(schedulingAssistant, { customerId: marta.id, date: inDays(2), time: '23:30' });
  await createVisit(schedulingAssistant, { customerId: joao.id, date: inDays(5), time: '10:00' });
  const [first] = (await visitsOf(schedulingAssistant)).sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
  );
  await runTool(visitTools(schedulingAssistant), 'cancelVisit', { visitId: first!.id });

  const { text } = await runTool(visitTools(schedulingAssistant), 'listVisits', { from: inDays(1), to: inDays(2) });

  const listed = JSON.parse(text) as { customer: { name: string }; when: string; status: string }[];
  expect(listed.map(({ customer }) => customer.name)).toEqual(['Marta Lima']);
  expect(listed[0]!.when).toContain('às 23:30');
});

test('rescheduleVisit moves the Visit, checks conflicts with the others and asks for a new confirmation', async () => {
  const schedulingAssistant = await newAssistant();
  const joao = await newCustomer(schedulingAssistant);
  const marta = await newCustomer(schedulingAssistant, 'Marta Lima');
  await createVisit(schedulingAssistant, { customerId: joao.id, time: '09:00' });
  await createVisit(schedulingAssistant, { customerId: marta.id, time: '14:00' });
  const visit = (await visitsOf(schedulingAssistant)).find(({ customerId }) => customerId === joao.id)!;
  await db.update(visits).set({ status: 'confirmed' }).where(eq(visits.id, visit.id));

  const conflict = await runTool(visitTools(schedulingAssistant), 'rescheduleVisit', {
    visitId: visit.id,
    date: inDays(1),
    time: '14:00',
    allowConflict: false,
  });
  const moved = await runTool(visitTools(schedulingAssistant), 'rescheduleVisit', {
    visitId: visit.id,
    date: inDays(1),
    time: '09:30',
    allowConflict: false,
  });

  expect(conflict.text).toContain('conflito');
  expect(moved.isError).toBe(false);
  const [row] = await db.select().from(visits).where(eq(visits.id, visit.id));
  expect(localDate(row!.scheduledAt, 'America/Sao_Paulo')).toBe(inDays(1));
  expect(row).toMatchObject({ status: 'scheduled', durationMinutes: 60 });
});

test('cancelVisit cancels only a Visit of the Professional', async () => {
  const schedulingAssistant = await newAssistant();
  const intruder = await newAssistant();
  const joao = await newCustomer(schedulingAssistant);
  await createVisit(schedulingAssistant, { customerId: joao.id });
  const [visit] = await visitsOf(schedulingAssistant);

  const foreign = await runTool(visitTools(intruder), 'cancelVisit', { visitId: visit!.id });
  const own = await runTool(visitTools(schedulingAssistant), 'cancelVisit', { visitId: visit!.id });

  expect(foreign.isError).toBe(true);
  expect(own.isError).toBe(false);
  expect(await visitsOf(schedulingAssistant)).toEqual([expect.objectContaining({ status: 'cancelled' })]);
});

test('createVisit refuses a date that does not exist instead of rolling it over', async () => {
  const schedulingAssistant = await newAssistant();
  const joao = await newCustomer(schedulingAssistant);

  const { isError } = await createVisit(schedulingAssistant, { customerId: joao.id, date: '2099-02-31' });

  expect(isError).toBe(true);
  expect(await visitsOf(schedulingAssistant)).toEqual([]);
});

test('createVisit refuses a duration that is not a whole number of minutes', async () => {
  const schedulingAssistant = await newAssistant();
  const joao = await newCustomer(schedulingAssistant);

  const fractional = await createVisit(schedulingAssistant, { customerId: joao.id, durationMinutes: 45.5 });
  const negative = await createVisit(schedulingAssistant, { customerId: joao.id, durationMinutes: -30 });

  expect(fractional.isError).toBe(true);
  expect(negative.isError).toBe(true);
  expect(await visitsOf(schedulingAssistant)).toEqual([]);
});
