import { expect, test } from 'bun:test';
import { idleTurn, nextTurn, type TurnEvent } from './turn';

function play(events: TurnEvent[]) {
  return events.reduce(nextTurn, idleTurn);
}

test('the latest status shows while the Assistant calls its tools', () => {
  expect(
    play([
      { type: 'assistant', assistantId: 'lia' },
      { type: 'status', text: 'Procurando o cliente' },
      { type: 'status', text: 'Olhando a agenda' },
    ]),
  ).toEqual({ draft: '', status: 'Olhando a agenda' });
});

test('the reply the Assistant starts writing takes the place of the status', () => {
  expect(
    play([
      { type: 'status', text: 'Olhando a agenda' },
      { type: 'text', text: 'Tenho segunda ' },
      { type: 'text', text: 'às 10h.' },
    ]),
  ).toEqual({ draft: 'Tenho segunda às 10h.', status: null });
});

test('a saved message clears the reply and the status, and the next tool brings a new status', () => {
  expect(
    play([
      { type: 'text', text: 'Vou ver a agenda.' },
      { type: 'status', text: 'Olhando a agenda' },
      { type: 'message' },
    ]),
  ).toEqual(idleTurn);
  expect(play([{ type: 'message' }, { type: 'status', text: 'Marcando a visita' }])).toEqual({
    draft: '',
    status: 'Marcando a visita',
  });
});

test('the teammate who answers next starts without the status of the one before', () => {
  expect(
    play([{ type: 'status', text: 'Chamando Lia' }, { type: 'message' }, { type: 'assistant', assistantId: 'lia' }]),
  ).toEqual(idleTurn);
  expect(
    play([
      { type: 'status', text: 'Chamando Lia' },
      { type: 'assistant', assistantId: 'lia' },
    ]).status,
  ).toBeNull();
});
