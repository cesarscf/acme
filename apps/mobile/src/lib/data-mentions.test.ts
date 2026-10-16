import { expect, test } from 'bun:test';
import { insertDataMention, opensDataMenu, splitDataMentions } from './data-mentions';

test('picking a mention puts it in the field followed by a space, replacing the @ being typed', () => {
  expect(insertDataMention('Me mostra a @', '@agenda')).toBe('Me mostra a @agenda ');
  expect(insertDataMention('@', '@agenda')).toBe('@agenda ');
});

test('picking from the @ button adds the mention after what is written', () => {
  expect(insertDataMention('', '@cobranças')).toBe('@cobranças ');
  expect(insertDataMention('Quero ver', '@caixa')).toBe('Quero ver @caixa ');
  expect(insertDataMention('Quero ver ', '@caixa')).toBe('Quero ver @caixa ');
});

test('typing @ at the start of a word opens the menu; in the middle of a word it does not', () => {
  expect(opensDataMenu('@')).toBe(true);
  expect(opensDataMenu('me mostra @')).toBe(true);
  expect(opensDataMenu('joao@')).toBe(false);
  expect(opensDataMenu('me mostra @a')).toBe(false);
});

test('the mentions are split out to be colored, and the rest of the text is not', () => {
  expect(splitDataMentions('@agenda da semana que vem')).toEqual([
    { mention: '@agenda' },
    { text: ' da semana que vem' },
  ]);
  expect(splitDataMentions('quero @cobranças do João e o @caixa')).toEqual([
    { text: 'quero ' },
    { mention: '@cobranças' },
    { text: ' do João e o ' },
    { mention: '@caixa' },
  ]);
});

test('an e-mail or a longer word is not a mention', () => {
  expect(splitDataMentions('manda para joao@agenda.com')).toEqual([{ text: 'manda para joao@agenda.com' }]);
  expect(splitDataMentions('@agendamento')).toEqual([{ text: '@agendamento' }]);
});
