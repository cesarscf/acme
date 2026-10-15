import { expect, test } from 'bun:test';
import { formatListTime, formatTime, formatWhen } from './when';

test('says today, yesterday or the date, with the time', () => {
  const now = new Date(2026, 9, 15, 18, 0);
  expect(formatWhen(new Date(2026, 9, 15, 15, 42), now)).toBe('Hoje, 15:42');
  expect(formatWhen(new Date(2026, 9, 14, 9, 5), now)).toBe('Ontem, 09:05');
  expect(formatWhen(new Date(2026, 9, 2, 8, 0), now)).toBe('02/10, 08:00');
});

test('the time alone, as in "Pago às 15:44"', () => {
  expect(formatTime(new Date(2026, 9, 15, 15, 44))).toBe('15:44');
  expect(formatTime(new Date(2026, 9, 15, 9, 5))).toBe('09:05');
});

test('the home list says agora, the time today, Ontem, then the date', () => {
  const now = new Date(2026, 9, 15, 18, 0);
  expect(formatListTime(new Date(2026, 9, 15, 17, 59, 30), now)).toBe('agora');
  expect(formatListTime(new Date(2026, 9, 15, 10, 27), now)).toBe('10:27');
  expect(formatListTime(new Date(2026, 9, 14, 22, 0), now)).toBe('Ontem');
  expect(formatListTime(new Date(2026, 9, 2, 8, 0), now)).toBe('02/10');
});
