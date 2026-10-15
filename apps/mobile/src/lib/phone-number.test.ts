import { expect, test } from 'bun:test';
import { toPhoneNumber } from './phone-number';

test('a Brazilian number typed with area code gets the country code', () => {
  expect(toPhoneNumber('(11) 98765-4321')).toBe('5511987654321');
});

test('a number already with +55 keeps it', () => {
  expect(toPhoneNumber('+55 11 98765-4321')).toBe('5511987654321');
});

test('a landline with 8 digits is accepted', () => {
  expect(toPhoneNumber('11 3456-7890')).toBe('551134567890');
});

test('a number too short is refused', () => {
  expect(toPhoneNumber('98765-4321')).toBeUndefined();
});
