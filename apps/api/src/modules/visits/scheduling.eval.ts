import { describe, expect, test } from 'bun:test';
import {
  acceptSuggestion,
  called,
  customerOf,
  notice,
  say,
  scriptedAssistant,
} from '../conversations/scripted-conversation';
import { addDays, localDate, toInstant } from '../time/time';
import { createVisit } from './service';

// Real model, real tokens: run with `bun run evals`, never in `bun run test`.
const timeZone = 'America/Sao_Paulo';
const today = () => localDate(new Date(), timeZone);

describe('the scheduling Assistant', () => {
  test('"marca o João amanhã às 14h" books the Visit for the João on file', async () => {
    const assistant = await scriptedAssistant('scheduling');
    const joao = await customerOf(assistant, 'João Pereira');

    const turn = await say(assistant, 'marca o joão amanhã às 14h');

    expect(turn.calls).toContainEqual(called('findCustomer'));
    expect(turn.calls).toContainEqual(
      called('createVisit', { customerId: joao.id, date: addDays(today(), 1), time: '14:00' }),
    );
    expect(turn.calls).not.toContainEqual(called('createCustomer'));
  });

  test('what the Customer asked for becomes the title of the Visit, and nothing is invented without it', async () => {
    const assistant = await scriptedAssistant('scheduling');
    const joao = await customerOf(assistant, 'João Pereira');

    const asked = await say(assistant, 'marca o joão amanhã às 9h, o ar da sala dele não gela');
    const plain = await say(assistant, 'e marca ele de novo depois de amanhã às 10h');

    const titled = asked.calls.find(({ name }) => name === 'createVisit')!;
    expect(titled.input).toMatchObject({ customerId: joao.id, date: addDays(today(), 1), time: '09:00' });
    expect(String(titled.input.title)).toMatch(/ar/i);
    expect(plain.calls).toContainEqual(called('createVisit', { date: addDays(today(), 2), title: null }));
  });

  test('a transcribed audio with a new Customer registers her WhatsApp and books the Visit', async () => {
    const assistant = await scriptedAssistant('scheduling');

    const turn = await say(
      assistant,
      'é... marca aí a dona Marta Ribeiro pra depois de amanhã, oito e meia da manhã, ela é cliente nova, o zap dela é 11 98765-4321',
    );

    expect(turn.calls).toContainEqual(called('createCustomer', { phoneNumber: expect.stringContaining('98765') }));
    const createCustomer = turn.calls.find(({ name }) => name === 'createCustomer')!;
    expect(String(createCustomer.input.name)).toContain('Marta');
    expect(turn.calls).toContainEqual(called('createVisit', { date: addDays(today(), 2), time: '08:30' }));
  });

  test('without a time, it asks for one instead of inventing it', async () => {
    const assistant = await scriptedAssistant('scheduling');
    await customerOf(assistant, 'João Pereira');

    const turn = await say(assistant, 'Marca o João amanhã');

    expect(turn.calls).not.toContainEqual(called('createVisit'));
    expect(turn.reply).toMatch(/hor/i);
  });

  test('after an approved Quote, "Marcar a visita" asks the day and time, then books what the Professional said', async () => {
    const assistant = await scriptedAssistant('scheduling');
    const joao = await customerOf(assistant, 'João Pereira');
    const approval = await notice(assistant, 'João Pereira aprovou o orçamento de R$ 450,00.', {
      suggestion: 'book_visit',
      customerId: joao.id,
    });

    const asked = await acceptSuggestion(assistant, { id: approval.id, customerName: joao.name });

    expect(asked.calls).toContainEqual(called('findCustomer'));
    expect(asked.calls).not.toContainEqual(called('createVisit'));
    expect(asked.calls).not.toContainEqual(called('sendVisitConfirmation'));

    const booked = await say(assistant, 'amanhã às 9h');

    expect(booked.calls).toContainEqual(
      called('createVisit', { customerId: joao.id, date: addDays(today(), 1), time: '09:00' }),
    );
    expect(booked.calls).not.toContainEqual(called('sendVisitConfirmation'));
  });

  test('after "Agora não", the next message about something else does not book a Visit for that Customer', async () => {
    const assistant = await scriptedAssistant('scheduling');
    const joao = await customerOf(assistant, 'João Pereira');
    await notice(assistant, 'João Pereira aprovou o orçamento de R$ 450,00.', {
      suggestion: 'book_visit',
      customerId: joao.id,
      suggestionAnswer: 'dismissed',
    });

    const turn = await say(assistant, 'o que eu tenho marcado pra amanhã?');

    expect(turn.calls).toContainEqual(called('listVisits', { from: addDays(today(), 1) }));
    expect(turn.calls).not.toContainEqual(called('createVisit'));
  });

  test('"o João pediu pra passar pra depois de amanhã às 15h" reschedules his Visit', async () => {
    const assistant = await scriptedAssistant('scheduling');
    const joao = await customerOf(assistant, 'João Pereira');
    const visit = await createVisit(assistant.professional.id, joao.id, {
      scheduledAt: toInstant(addDays(today(), 1), '10:00', timeZone),
      durationMinutes: 60,
    });

    const turn = await say(assistant, 'o joão pediu pra passar a visita dele pra depois de amanhã às 15h');

    expect(turn.calls).toContainEqual(
      called('rescheduleVisit', { visitId: visit.id, date: addDays(today(), 2), time: '15:00' }),
    );
    expect(turn.calls).not.toContainEqual(called('createVisit'));
    expect(turn.calls).not.toContainEqual(called('cancelVisit'));
  });

  test('a time that clashes with another Visit is not booked over it without asking', async () => {
    const assistant = await scriptedAssistant('scheduling');
    const joao = await customerOf(assistant, 'João Pereira');
    const maria = await customerOf(assistant, 'Maria Lima');
    await createVisit(assistant.professional.id, maria.id, {
      scheduledAt: toInstant(addDays(today(), 1), '14:00', timeZone),
      durationMinutes: 60,
    });

    const turn = await say(assistant, 'Marca o João amanhã às 14h');

    expect(turn.calls).toContainEqual(called('createVisit', { customerId: joao.id, allowConflict: false }));
    expect(turn.calls).not.toContainEqual(called('createVisit', { allowConflict: true }));
    expect(turn.reply).toMatch(/Maria/);
  });
});
