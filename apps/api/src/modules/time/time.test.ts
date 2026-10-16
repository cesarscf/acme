import { expect, test } from 'bun:test';
import { daysAgo, formatLocalDateTime, localDate, localTime, nextDay, shortDate, shortDay, toInstant } from './time';

test('a local date and time in São Paulo is stored three hours later in UTC', () => {
  expect(toInstant('2026-10-16', '14:00', 'America/Sao_Paulo')).toEqual(new Date('2026-10-16T17:00:00Z'));
});

test('a local time follows the time zone offset on that date', () => {
  expect(toInstant('2026-01-15', '09:30', 'Europe/Lisbon')).toEqual(new Date('2026-01-15T09:30:00Z'));
  expect(toInstant('2026-07-15', '09:30', 'Europe/Lisbon')).toEqual(new Date('2026-07-15T08:30:00Z'));
});

test('an instant reads back as the local weekday, date and time', () => {
  expect(formatLocalDateTime(new Date('2026-10-16T17:00:00Z'), 'America/Sao_Paulo')).toBe(
    'sexta-feira, 16/10, às 14:00',
  );
});

test('the local date of an instant near midnight is the previous day in São Paulo', () => {
  expect(localDate(new Date('2026-10-16T02:00:00Z'), 'America/Sao_Paulo')).toBe('2026-10-15');
});

test('the day after the last day of a month is the first of the next one', () => {
  expect(nextDay('2026-02-28')).toBe('2026-03-01');
  expect(nextDay('2026-12-31')).toBe('2027-01-01');
});

test('a short day and date read in Portuguese, in the local time zone', () => {
  const saturday = new Date('2026-10-17T02:30:00Z');
  expect(shortDay(saturday, 'America/Sao_Paulo')).toBe('Sex, 16 out');
  expect(shortDate(saturday, 'America/Sao_Paulo')).toBe('16 OUT');
  expect(localTime(saturday, 'America/Sao_Paulo')).toBe('23:30');
});

test('days ago counts local days, so just before midnight is still today', () => {
  const now = new Date('2026-10-17T02:59:00Z');
  expect(daysAgo(new Date('2026-10-16T03:00:00Z'), 'America/Sao_Paulo', now)).toBe(0);
  expect(daysAgo(new Date('2026-10-16T02:59:00Z'), 'America/Sao_Paulo', now)).toBe(1);
  expect(daysAgo(new Date('2026-10-20T12:00:00Z'), 'America/Sao_Paulo', now)).toBe(-4);
});
