import { describe, expect, test } from 'bun:test';
import { called, customerOf, sayInThread, scriptedTeam } from '../conversations/scripted-conversation';
import { upsertPriceItem } from '../quotes/service';
import { createVisit } from '../visits/service';
import { addDays, localDate, toInstant } from '../visits/time';

// Real model, real tokens: run with `bun run evals`, never in `bun run test`.
const timeZone = 'America/Sao_Paulo';
const today = () => localDate(new Date(), timeZone);

function nextMonday() {
  let day = addDays(today(), 1);
  while (new Date(`${day}T12:00:00Z`).getUTCDay() !== 1) day = addDays(day, 1);
  return day;
}

async function teamWithJoaosVisit() {
  const team = await scriptedTeam();
  await upsertPriceItem(team.professional.id, { name: 'Limpeza de split', priceCents: 15000 });
  const joao = await customerOf(team, 'João Pereira');
  const visit = await createVisit(
    team.professional.id,
    joao.id,
    { scheduledAt: toInstant(addDays(today(), 1), '14:00', timeZone), durationMinutes: 60 },
    'Ar da sala não gela',
  );
  return { professionalId: team.professional.id, joao, visit };
}

function totalOf(call: { input: Record<string, unknown> } | undefined) {
  const items = (call?.input.items ?? []) as { quantity: number; unitPriceCents: number | null }[];
  return items.reduce((sum, { quantity, unitPriceCents }) => sum + quantity * (unitPriceCents ?? 0), 0);
}

describe('the team in a Customer thread', () => {
  test('a request with a quote and a schedule part gets both done by the team, without the Professional relaying', async () => {
    const { professionalId, joao } = await teamWithJoaosVisit();

    const turn = await sayInThread(
      professionalId,
      joao.id,
      'Lia consegui adiantar a visita, e foi acordado troca de compressor por 2000 reais sendo 200 de mão de obra, envie o orçamento para o cliente confirmar e envie opções de data para o agendamento do serviço',
    );

    expect(turn.answered).toContain('quotes');
    expect(totalOf(turn.calls.find(({ name }) => name === 'createQuote'))).toBe(200000);
    expect(turn.calls).toContainEqual(called('sendQuote'));
    // Nobody sends the Professional to another Assistant, and nobody promises a message the tools cannot send.
    expect(turn.reply).not.toMatch(/acionad|pe[çc]a (a|à|para a) (Lia|Olga|Tina)|fale com a/i);
    expect(turn.reply).not.toMatch(/envio (as|os) (op[çc][õo]es|hor[áa]rios)/i);
  });

  test('"Manda um orçamento de troca do compressor…" makes the quotes Assistant quote João and show the card', async () => {
    const { professionalId, joao } = await teamWithJoaosVisit();

    const turn = await sayInThread(
      professionalId,
      joao.id,
      'Manda um orçamento de troca do compressor, 1.200 a peça e 250 a mão de obra',
    );

    expect(turn.role).toBe('quotes');
    const quote = turn.calls.find(({ name }) => name === 'createQuote');
    expect(quote?.input.customerId).toBe(joao.id);
    expect(totalOf(quote)).toBe(145000);
    expect(turn.calls).toContainEqual(called('sendQuote'));
    expect(turn.calls).not.toContainEqual(called('createCustomer'));
    expect(turn.end).toEqual({ type: 'awaiting_confirmation' });
  });

  test('"Remarca para segunda às 10h" makes the scheduling Assistant move the open Job\'s Visit and ask João to confirm', async () => {
    const { professionalId, joao, visit } = await teamWithJoaosVisit();

    const turn = await sayInThread(professionalId, joao.id, 'Remarca para segunda às 10h');

    expect(turn.role).toBe('scheduling');
    expect(turn.calls).toContainEqual(
      called('rescheduleVisit', { visitId: visit.id, date: nextMonday(), time: '10:00' }),
    );
    expect(turn.calls).toContainEqual(called('sendVisitConfirmation', { visitId: visit.id }));
    expect(turn.end).toEqual({ type: 'awaiting_confirmation' });
  });

  test("the answer to an Assistant's question goes back to that Assistant", async () => {
    const { professionalId, joao } = await teamWithJoaosVisit();

    const asked = await sayInThread(professionalId, joao.id, 'Manda um orçamento de troca de compressor');
    const answered = await sayInThread(professionalId, joao.id, '1.450 com a mão de obra');

    expect(asked.role).toBe('quotes');
    expect(asked.calls).not.toContainEqual(called('createQuote'));
    expect(answered.role).toBe('quotes');
    const quote = answered.calls.find(({ name }) => name === 'createQuote');
    expect(quote?.input.customerId).toBe(joao.id);
    expect(totalOf(quote)).toBe(145000);
  });
});
