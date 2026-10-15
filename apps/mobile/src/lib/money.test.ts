import { expect, test } from 'bun:test';
import { formatMoney, formatWholeMoney } from './money';

test('shows cents as reais, the way the prototype writes them', () => {
  expect(formatMoney(35000).replace(/\s/g, ' ')).toBe('R$ 350,00');
  expect(formatMoney(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
});

test('drops ",00" in a sentence, as in "cobrar R$ 350 do João"', () => {
  expect(formatWholeMoney(35000).replace(/\s/g, ' ')).toBe('R$ 350');
  expect(formatWholeMoney(35050).replace(/\s/g, ' ')).toBe('R$ 350,50');
});
