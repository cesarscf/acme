import { describe, expect, test } from 'bun:test';
import { assistants, charges, db, workRecords } from '@acme/db';
import { and, eq } from 'drizzle-orm';
import { createCharge } from '../charges/service';
import { called, customerOf, sayInThread, scriptedTeam } from '../conversations/scripted-conversation';
import { openJob } from '../jobs/service';

// Real model, real tokens: run with `bun run evals`, never in `bun run test`.
const pixAccount = {
  paymentMethods: { accepted: ['pix', 'cash'], default: 'pix' },
  pixKey: { type: 'email', key: 'carlos@example.com' },
  pixName: 'Carlos Souza',
  pixCity: 'Campinas',
};

async function joaosRecord(amountCents: number | null) {
  const team = await scriptedTeam();
  const professionalId = team.professional.id;
  await db
    .update(assistants)
    .set({ playbook: pixAccount })
    .where(and(eq(assistants.professionalId, professionalId), eq(assistants.role, 'billing')));
  const joao = await customerOf(team, 'João Pereira');
  const jobId = await openJob(professionalId, joao.id, 'Ar da sala não gela');
  const [workRecord] = await db
    .insert(workRecords)
    .values({
      professionalId,
      customerId: joao.id,
      jobId,
      title: 'Limpeza de split',
      description: 'Limpeza de split e troca de capacitor',
      amountCents,
      paymentMethod: 'pix',
      transcript: 'Limpei o split do João e troquei o capacitor.',
    })
    .returning();
  return { professionalId, joao, workRecord: workRecord! };
}

describe('the service record in the Customer thread', () => {
  test('"Ficou 350 no Pix" after a visit registered without an amount completes that record', async () => {
    const { professionalId, joao, workRecord } = await joaosRecord(null);

    const turn = await sayInThread(professionalId, joao.id, 'Ficou 350 no Pix');

    expect(turn.role).toBe('billing');
    expect(turn.calls).toContainEqual(called('updateWorkRecord', { workRecordId: workRecord.id }));
    const [saved] = await db.select().from(workRecords).where(eq(workRecords.id, workRecord.id));
    expect(saved!.amountCents).toBe(35000);
  });

  test('"Cobrar no Pix" from the action makes the Tina charge the registered service and show the card', async () => {
    const { professionalId, joao, workRecord } = await joaosRecord(35000);

    const turn = await sayInThread(professionalId, joao.id, 'Cobrar no Pix', 'billing');

    expect(turn.calls).toContainEqual(called('createCharge', { workRecordId: workRecord.id }));
    expect(turn.calls).toContainEqual(called('sendCharge'));
    expect(turn.end).toEqual({ type: 'awaiting_confirmation' });
  });

  test('"Recebi" to "João disse que já pagou" marks the Pix paid', async () => {
    const { professionalId, joao, workRecord } = await joaosRecord(35000);
    const created = await createCharge(professionalId, workRecord.id);
    if (!created.charge) throw new Error(`No Charge: ${created.refused}`);
    await db
      .update(charges)
      .set({ status: 'awaiting_confirmation', sentAt: new Date() })
      .where(eq(charges.id, created.charge.id));

    const turn = await sayInThread(professionalId, joao.id, 'Recebi', 'billing');

    expect(turn.calls).toContainEqual(called('confirmChargePaid', { chargeId: created.charge.id, received: true }));
    expect(turn.calls).not.toContainEqual(called('sendCharge'));
  });
});
