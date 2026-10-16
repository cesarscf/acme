import { describe, expect, test } from 'bun:test';
import { called, say, scriptedAssistant } from '../conversations/scripted-conversation';
import { addDays, localDate } from '../time/time';

// Real model, real tokens: run with `bun run evals`, never in `bun run test`.
const timeZone = 'America/Sao_Paulo';
const today = () => localDate(new Date(), timeZone);

function nextMonday() {
  let day = addDays(today(), 1);
  while (new Date(`${day}T12:00:00Z`).getUTCDay() !== 1) day = addDays(day, 1);
  return day;
}

describe('@agenda in the scheduling chat', () => {
  test('"@agenda" alone lists today', async () => {
    const assistant = await scriptedAssistant('scheduling');

    const turn = await say(assistant, '@agenda');

    expect(turn.calls).toContainEqual(called('listVisits', { from: today(), to: today() }));
  });

  test('"@agenda de amanhã" lists tomorrow', async () => {
    const assistant = await scriptedAssistant('scheduling');
    const tomorrow = addDays(today(), 1);

    const turn = await say(assistant, '@agenda de amanhã');

    expect(turn.calls).toContainEqual(called('listVisits', { from: tomorrow, to: tomorrow }));
  });

  test('"@agenda da semana que vem" lists next week, without repeating the list in the reply', async () => {
    const assistant = await scriptedAssistant('scheduling');
    const monday = nextMonday();

    const turn = await say(assistant, '@agenda da semana que vem');

    const call = turn.calls.find(({ name }) => name === 'listVisits');
    expect(call?.input.from).toBe(monday);
    expect([addDays(monday, 4), addDays(monday, 5), addDays(monday, 6)]).toContain(call?.input.to as string);
    expect(turn.reply.length).toBeLessThan(200);
  });
});
