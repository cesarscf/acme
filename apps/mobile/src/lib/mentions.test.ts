import { expect, test } from 'bun:test';
import { splitMentions, withoutOpeningMention } from './mentions';

const team = ['Lia', 'Olga', 'Tina'];

test('a teammate named in the text becomes a mention, with or without the @', () => {
  expect(splitMentions('@Lia, veja um horário. Avisei a Olga.', team)).toEqual([
    { mention: 'Lia' },
    { text: ', veja um horário. Avisei a ' },
    { mention: 'Olga' },
    { text: '.' },
  ]);
});

test('a name inside another word, or in other casing, is just text', () => {
  expect(splitMentions('Liana e olga e Constantina', team)).toEqual([{ text: 'Liana e olga e Constantina' }]);
});

test('accented letters around the name keep it a word', () => {
  expect(splitMentions('Tinaé', team)).toEqual([{ text: 'Tinaé' }]);
  expect(splitMentions('(Tina)', team)).toEqual([{ text: '(' }, { mention: 'Tina' }, { text: ')' }]);
});

test('without a team, the text stays whole', () => {
  expect(splitMentions('Oi Lia', [])).toEqual([{ text: 'Oi Lia' }]);
});

test('a request that opens by naming who it calls drops that name, since the card already shows it', () => {
  expect(withoutOpeningMention('@Lia, veja um horário.', 'Lia', team)).toBe('veja um horário.');
  expect(withoutOpeningMention('Lia: veja com a Olga.', 'Lia', team)).toBe('veja com a Olga.');
  expect(withoutOpeningMention('Veja com a Lia.', 'Lia', team)).toBe('Veja com a Lia.');
});
