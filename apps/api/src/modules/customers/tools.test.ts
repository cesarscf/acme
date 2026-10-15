import { expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { customers, db } from '@acme/db';
import { eq } from 'drizzle-orm';
import { newAssistant, runTool } from '../conversations/test-tools';
import { customerTools } from './tools';

function newPhoneNumber() {
  return `55119${String(randomInt(1e8)).padStart(8, '0')}`;
}

test('createCustomer saves the Customer with the phone number in digits, country code included', async () => {
  const schedulingAssistant = await newAssistant();
  const typed = newPhoneNumber()
    .slice(2)
    .replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');

  const { text, isError } = await runTool(customerTools(schedulingAssistant), 'createCustomer', {
    name: 'João Pereira',
    phoneNumber: typed,
  });

  expect(isError).toBe(false);
  const saved = await db
    .select()
    .from(customers)
    .where(eq(customers.professionalId, schedulingAssistant.professional.id));
  expect(saved).toEqual([
    expect.objectContaining({ name: 'João Pereira', phoneNumber: `55${typed.replace(/\D/g, '')}` }),
  ]);
  expect(text).toContain(saved[0]!.id);
});

test('createCustomer with a phone number the Professional already has returns that Customer', async () => {
  const schedulingAssistant = await newAssistant();
  const phoneNumber = newPhoneNumber();
  await runTool(customerTools(schedulingAssistant), 'createCustomer', { name: 'João Pereira', phoneNumber });

  const { text, isError } = await runTool(customerTools(schedulingAssistant), 'createCustomer', {
    name: 'João',
    phoneNumber,
  });

  expect(isError).toBe(false);
  expect(text).toContain('João Pereira');
  expect(
    await db.select().from(customers).where(eq(customers.professionalId, schedulingAssistant.professional.id)),
  ).toHaveLength(1);
});

test('createCustomer refuses a phone number without the area code', async () => {
  const schedulingAssistant = await newAssistant();

  const { text, isError } = await runTool(customerTools(schedulingAssistant), 'createCustomer', {
    name: 'João',
    phoneNumber: '98765-4321',
  });

  expect(isError).toBe(true);
  expect(text).toContain('DDD');
});

test("findCustomer finds the Professional's Customers by part of the name or the phone number", async () => {
  const schedulingAssistant = await newAssistant();
  const other = await newAssistant();
  const phoneNumber = newPhoneNumber();
  await runTool(customerTools(schedulingAssistant), 'createCustomer', { name: 'João Pereira', phoneNumber });
  await runTool(customerTools(schedulingAssistant), 'createCustomer', {
    name: 'Marta Lima',
    phoneNumber: newPhoneNumber(),
  });
  await runTool(customerTools(other), 'createCustomer', { name: 'João Silva', phoneNumber: newPhoneNumber() });

  const byName = await runTool(customerTools(schedulingAssistant), 'findCustomer', { query: 'joão' });
  const byPhone = await runTool(customerTools(schedulingAssistant), 'findCustomer', { query: phoneNumber.slice(-8) });

  expect(JSON.parse(byName.text)).toEqual([expect.objectContaining({ name: 'João Pereira', phoneNumber })]);
  expect(JSON.parse(byPhone.text)).toEqual([expect.objectContaining({ name: 'João Pereira' })]);
});

test('findCustomer says when nobody matches', async () => {
  const schedulingAssistant = await newAssistant();

  const { text } = await runTool(customerTools(schedulingAssistant), 'findCustomer', { query: 'Ninguém' });

  expect(text).toContain('Nenhum cliente');
});
