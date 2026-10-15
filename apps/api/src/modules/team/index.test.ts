import { expect, test } from 'bun:test';
import { assistantMessages, assistantNotices, assistants, db } from '@acme/db';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { catalogEntry } from './catalog';

const api = treaty(app);

test('the Catalog offers scheduling, quotes and billing, and the other Roles as coming soon', async () => {
  const { data, status } = await api.catalog.get();

  expect(status).toBe(200);
  const available = data?.filter((entry) => entry.available).map(({ role }) => role);
  const comingSoon = data?.filter((entry) => !entry.available).map(({ role }) => role);
  expect(available).toEqual(['scheduling', 'quotes', 'billing']);
  expect(comingSoon).toEqual(['routes', 'inventory', 'crew', 'finance', 'tax_receipts', 'relationship']);
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
    expect.objectContaining({
      role: 'scheduling',
      name: catalogEntry('scheduling').name,
      title: 'Agenda',
      playbookStatus: 'draft',
    }),
    expect.objectContaining({
      role: 'billing',
      name: catalogEntry('billing').name,
      title: 'Cobrança',
      playbookStatus: 'draft',
    }),
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
  expect(data?.map(({ name }) => name)).toEqual([catalogEntry('scheduling').name, catalogEntry('quotes').name]);
});

test('each Assistant comes with what was said last in its conversation', async () => {
  const { headers } = await signInNewProfessional();
  await api.team.post({ roles: ['scheduling', 'billing'] }, { headers });
  const { data: team } = await api.team.get({ headers });
  const [scheduling, billing] = team!;
  expect(scheduling?.lastMessage).toBeNull();

  await db.insert(assistantMessages).values([
    { assistantId: scheduling!.id, role: 'user', content: [{ type: 'text', text: 'Marca o João amanhã' }] },
    {
      assistantId: scheduling!.id,
      role: 'assistant',
      content: [
        { type: 'text', text: 'Marquei às 9h.' },
        { type: 'tool_use', id: 'toolu_1', name: 'x', input: {} },
      ],
    },
    { assistantId: scheduling!.id, role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1' }] },
  ]);
  await db.insert(assistantMessages).values({
    assistantId: billing!.id,
    role: 'assistant',
    content: [{ type: 'text', text: 'Cobrança enviada.' }],
  });
  await db.insert(assistantNotices).values({ assistantId: billing!.id, text: 'O João pagou.' });

  const { data } = await api.team.get({ headers });
  expect(data?.map(({ lastMessage }) => lastMessage && { from: lastMessage.from, text: lastMessage.text })).toEqual([
    { from: 'assistant', text: 'Marquei às 9h.' },
    { from: 'notice', text: 'O João pagou.' },
  ]);
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

test('renaming the scheduling Assistant changes its name in the Team', async () => {
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
  expect(data?.[0]?.name).toBe(catalogEntry('scheduling').name);
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
