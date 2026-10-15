import { expect, test } from 'bun:test';
import { formatMoneyInput, parseMoney } from './money';

test('reads amounts the way people type them', () => {
  expect(parseMoney('350')).toBe(35000);
  expect(parseMoney('350,5')).toBe(35050);
  expect(parseMoney('R$ 1.234,56')).toBe(123456);
  expect(parseMoney('0')).toBeNull();
  expect(parseMoney('3,505')).toBeNull();
  expect(parseMoney('')).toBeNull();
});

test('writes cents back as the field shows them', () => {
  expect(formatMoneyInput(35000)).toBe('350,00');
  expect(parseMoney(formatMoneyInput(123456))).toBe(123456);
});
