import { expect, test } from 'bun:test';
import { apiUrl } from './api-url';

test('points at port 3000 on the host that serves Metro', () => {
  expect(apiUrl({ metroHost: '192.168.0.10:8081' })).toBe('http://192.168.0.10:3000');
});

test('prefers an explicit URL', () => {
  expect(apiUrl({ explicit: 'https://api.example.com', metroHost: '192.168.0.10:8081' })).toBe(
    'https://api.example.com',
  );
});

test('falls back to localhost', () => {
  expect(apiUrl({})).toBe('http://localhost:3000');
});
