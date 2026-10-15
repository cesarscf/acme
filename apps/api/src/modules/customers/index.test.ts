import { expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { treaty } from '@elysia/eden';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';

const api = treaty(app);

function newNationalNumber() {
  return `119${String(randomInt(1e8)).padStart(8, '0')}`;
}

test('the form saves a Customer and the list shows it by name', async () => {
  const { headers } = await signInNewProfessional();
  const phoneNumber = newNationalNumber();

  await api.customers.post({ name: 'Marta Lima', phoneNumber: newNationalNumber() }, { headers });
  const { data, status } = await api.customers.post({ name: ' João Pereira ', phoneNumber }, { headers });

  expect(status).toBe(200);
  expect(data).toMatchObject({ name: 'João Pereira', phoneNumber: `55${phoneNumber}` });
  const { data: list } = await api.customers.get({ headers });
  expect(list!.map(({ name }) => name)).toEqual(['João Pereira', 'Marta Lima']);
});

test('the form refuses a number without the area code and a number that is already a Customer', async () => {
  const { headers } = await signInNewProfessional();
  const phoneNumber = newNationalNumber();
  await api.customers.post({ name: 'João', phoneNumber }, { headers });

  const invalid = await api.customers.post({ name: 'Ana', phoneNumber: '98765-4321' }, { headers });
  const repeated = await api.customers.post({ name: 'Outro João', phoneNumber: `+55 ${phoneNumber}` }, { headers });

  expect(invalid.status).toBe(422);
  expect(repeated.status).toBe(409);
  expect(repeated.error?.value).toMatchObject({ customer: { name: 'João' } });
});

test('a Professional sees only their own Customers', async () => {
  const owner = await signInNewProfessional();
  const other = await signInNewProfessional();
  await api.customers.post({ name: 'João', phoneNumber: newNationalNumber() }, { headers: owner.headers });

  const { data } = await api.customers.get({ headers: other.headers });

  expect(data).toEqual([]);
});
