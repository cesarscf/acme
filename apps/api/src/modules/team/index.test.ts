import { expect, test } from 'bun:test';
import { assistants, db } from '@acme/db';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';

const api = treaty(app);

test('the Catalog offers Lia, Olga and Tina, and the other Roles as coming soon', async () => {
  const { data, status } = await api.catalog.get();

  expect(status).toBe(200);
  const available = data?.filter((entry) => entry.available).map(({ name }) => name);
  const comingSoon = data?.filter((entry) => !entry.available).map(({ name }) => name);
  expect(available).toEqual(['Lia', 'Olga', 'Tina']);
  expect(comingSoon).toEqual(['Beto', 'Edu', 'Gil', 'Fábio', 'Nina', 'Duda']);
});

test('a new Professional has no Team yet', async () => {
  const { headers } = await signInNewProfessional();

  const { data } = await api.team.get({ headers });

  expect(data).toEqual([]);
});

test('choosing Roles creates Assistants named from the Catalog, with an empty draft Playbook', async () => {
  const { professional, headers } = await signInNewProfessional();

  const { status } = await api.team.post({ roles: ['scheduling', 'billing'] }, { headers });

  expect(status).toBe(200);
  const { data } = await api.team.get({ headers });
  expect(data).toEqual([
    expect.objectContaining({ role: 'scheduling', name: 'Lia', title: 'Agenda', playbookStatus: 'draft' }),
    expect.objectContaining({ role: 'billing', name: 'Tina', title: 'Cobrança', playbookStatus: 'draft' }),
  ]);
  const playbooks = await db
    .select({ playbook: assistants.playbook })
    .from(assistants)
    .where(eq(assistants.professionalId, professional.id));
  expect(playbooks).toEqual([{ playbook: {} }, { playbook: {} }]);
});

test('choosing a Role again keeps a single Assistant for it', async () => {
  const { headers } = await signInNewProfessional();
  await api.team.post({ roles: ['scheduling'] }, { headers });

  await api.team.post({ roles: ['scheduling', 'quotes'] }, { headers });

  const { data } = await api.team.get({ headers });
  expect(data?.map(({ name }) => name)).toEqual(['Lia', 'Olga']);
});

test('a coming soon Role cannot be chosen', async () => {
  const { headers } = await signInNewProfessional();

  // @ts-expect-error a Role that only exists in the Catalog
  const { status } = await api.team.post({ roles: ['routes'] }, { headers });

  expect(status).toBe(422);
});

test('the Team needs at least one Assistant', async () => {
  const { headers } = await signInNewProfessional();

  const { status } = await api.team.post({ roles: [] }, { headers });

  expect(status).toBe(422);
});

test('renaming Lia changes her name in the Team', async () => {
  const { headers } = await signInNewProfessional();
  await api.team.post({ roles: ['scheduling'] }, { headers });
  const { data: team } = await api.team.get({ headers });

  const { status } = await api.team({ id: team![0]!.id }).patch({ name: 'Ana' }, { headers });

  expect(status).toBe(200);
  const { data } = await api.team.get({ headers });
  expect(data).toEqual([expect.objectContaining({ role: 'scheduling', name: 'Ana' })]);
});

test("a Professional cannot rename someone else's Assistant", async () => {
  const owner = await signInNewProfessional();
  await api.team.post({ roles: ['scheduling'] }, { headers: owner.headers });
  const { data: team } = await api.team.get({ headers: owner.headers });
  const intruder = await signInNewProfessional();

  const { status } = await api.team({ id: team![0]!.id }).patch({ name: 'Ana' }, { headers: intruder.headers });

  expect(status).toBe(404);
  const { data } = await api.team.get({ headers: owner.headers });
  expect(data?.[0]?.name).toBe('Lia');
});

test('a blank name is refused', async () => {
  const { headers } = await signInNewProfessional();
  await api.team.post({ roles: ['scheduling'] }, { headers });
  const { data: team } = await api.team.get({ headers });

  const { status } = await api.team({ id: team![0]!.id }).patch({ name: '  ' }, { headers });

  expect(status).toBe(422);
});

test('the Team needs a session', async () => {
  const { status } = await api.team.get();

  expect(status).toBe(401);
});
