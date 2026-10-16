import { describe, expect, test } from 'bun:test';
import { charges, db, quotes, visits, workRecords } from '@acme/db';
import { eq } from 'drizzle-orm';
import { called, customerOf, sayInThread, scriptedTeam } from '../conversations/scripted-conversation';
import { openJob } from '../jobs/service';
import { addDays, localDate, toInstant } from '../time/time';
import { getCustomerThread } from './thread';

// Real model, real tokens: run with `bun run evals`, never in `bun run test`.
const timeZone = 'America/Sao_Paulo';
const at = (days: number, time: string) => toInstant(addDays(localDate(new Date(), timeZone), days), time, timeZone);

async function joaosJob() {
  const team = await scriptedTeam();
  const professionalId = team.professional.id;
  const joao = await customerOf(team, 'João Pereira');
  const jobId = await openJob(professionalId, joao.id, 'Ar da sala não gela');
  const visit = async (scheduledAt: Date, createdAt = new Date()) =>
    (
      await db
        .insert(visits)
        .values({ professionalId, customerId: joao.id, jobId, scheduledAt, durationMinutes: 60, createdAt })
        .returning()
    )[0]!;
  const quote = async (status: 'sent' | 'approved') =>
    (
      await db
        .insert(quotes)
        .values({
          professionalId,
          customerId: joao.id,
          jobId,
          totalCents: 145000,
          status,
          sentAt: new Date(Date.now() - 3_600_000),
        })
        .returning()
    )[0]!;
  return { professionalId, joao, jobId, visit, quote };
}

describe('the actions above the Customer thread', () => {
  test('"Pedir confirmação" makes the Lia ask João to confirm the Visit', async () => {
    const { professionalId, joao, visit } = await joaosJob();
    const booked = await visit(at(1, '09:00'));

    const turn = await sayInThread(professionalId, joao.id, 'Pedir confirmação', 'scheduling');

    expect(turn.calls).toContainEqual(called('sendVisitConfirmation', { visitId: booked.id }));
    expect(turn.end).toEqual({ type: 'awaiting_confirmation' });
  });

  test('"Lembrar do orçamento" makes the Olga send the Quote again', async () => {
    const { professionalId, joao, visit, quote } = await joaosJob();
    await visit(at(-1, '09:00'), new Date(Date.now() - 2 * 86_400_000));
    const sent = await quote('sent');

    const turn = await sayInThread(professionalId, joao.id, 'Lembrar do orçamento', 'quotes');

    expect(turn.calls).toContainEqual(called('sendQuote', { quoteId: sent.id }));
    expect(turn.end).toEqual({ type: 'awaiting_confirmation' });
  });

  test("picking a free time in the Lia's question books the execution in the same Job", async () => {
    const { professionalId, joao, jobId, visit, quote } = await joaosJob();
    await visit(at(-1, '09:00'), new Date(Date.now() - 2 * 86_400_000));
    await quote('approved');
    const thread = (await getCustomerThread(professionalId, joao.id))!;
    const question = thread.items.findLast((item) => item.type === 'question');
    if (question?.type !== 'question') throw new Error('No question');
    const slot = question.options[0]!.label;

    const turn = await sayInThread(professionalId, joao.id, slot, 'scheduling');

    expect(turn.calls).toContainEqual(called('createVisit', { customerId: joao.id }));
    const booked = await db.select().from(visits).where(eq(visits.jobId, jobId));
    expect(booked).toHaveLength(2);
  });

  test('"Reenviar o Pix" makes the Tina send the pending Pix again', async () => {
    const { professionalId, joao, jobId } = await joaosJob();
    const [record] = await db
      .insert(workRecords)
      .values({
        professionalId,
        customerId: joao.id,
        jobId,
        title: 'Troca do compressor',
        amountCents: 145000,
        paymentMethod: 'pix',
      })
      .returning();
    const [charge] = await db
      .insert(charges)
      .values({
        professionalId,
        workRecordId: record!.id,
        customerId: joao.id,
        amountCents: 145000,
        paymentMethod: 'pix',
        sentAt: new Date(Date.now() - 86_400_000),
      })
      .returning();

    const turn = await sayInThread(professionalId, joao.id, 'Reenviar o Pix', 'billing');

    expect(turn.calls).toContainEqual(called('sendCharge', { chargeId: charge!.id }));
  });
});
