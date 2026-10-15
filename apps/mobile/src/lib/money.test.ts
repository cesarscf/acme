import { expect, test } from 'bun:test';
import { formatMoney } from './money';

test('shows cents as reais, the way the prototype writes them', () => {
  expect(formatMoney(35000).replace(/\s/g, ' ')).toBe('R$ 350,00');
  expect(formatMoney(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
});
