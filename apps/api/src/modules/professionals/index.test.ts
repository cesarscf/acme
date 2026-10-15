import { expect, test } from 'bun:test';
import { treaty } from '@elysia/eden';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';

const api = treaty(app);

test('a new Professional is in the São Paulo timezone, with no Trade or WorkStyle yet', async () => {
  const { headers } = await signInNewProfessional();

  const { data, status } = await api.me.get({ headers });

  expect(status).toBe(200);
  expect(data).toMatchObject({ timezone: 'America/Sao_Paulo', trades: [], workStyle: null });
});

test('the Professional saves the name, Trades and WorkStyle from onboarding', async () => {
  const { headers } = await signInNewProfessional();

  const { status } = await api.me.patch(
    { name: 'Carlos da Refrigeração', trades: ['hvac', 'electrical'], workStyle: 'with_helper' },
    { headers },
  );

  expect(status).toBe(200);
  const { data } = await api.me.get({ headers });
  expect(data).toMatchObject({
    name: 'Carlos da Refrigeração',
    trades: ['hvac', 'electrical'],
    workStyle: 'with_helper',
  });
});

test('skipping the WorkStyle leaves it empty', async () => {
  const { headers } = await signInNewProfessional();
  await api.me.patch({ workStyle: 'solo' }, { headers });

  await api.me.patch({ workStyle: null }, { headers });

  const { data } = await api.me.get({ headers });
  expect(data?.workStyle).toBeNull();
});

test('a blank name is refused', async () => {
  const { headers } = await signInNewProfessional();

  const { status } = await api.me.patch({ name: '   ' }, { headers });

  expect(status).toBe(422);
});

test('the profile needs a session', async () => {
  const { status } = await api.me.patch({ name: 'Carlos' });

  expect(status).toBe(401);
});
