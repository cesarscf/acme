import { expect, test } from 'bun:test';
import type { CatalogEntry } from '@/hooks/data/catalog/use-catalog-query';
import { firstName, recommendedRoles, searchTrades, teamButtonLabel, tradesSummary } from './onboarding';

const entry = {
  name: 'Lia',
  title: 'Agenda',
  tagline: 'Marca as visitas',
  mascot: { shape: 'blob', color: '', light: '' },
};
const catalog: CatalogEntry[] = [
  { ...entry, role: 'scheduling', available: true, recommendedFor: ['solo', 'with_helper', 'with_crew'] },
  { ...entry, role: 'quotes', available: true, recommendedFor: ['with_helper'] },
  { ...entry, role: 'routes', available: false, recommendedFor: ['solo', 'with_helper'] },
] as CatalogEntry[];

test('the Roles recommended for the WorkStyle come checked, leaving out the coming soon ones', () => {
  expect(recommendedRoles(catalog, 'with_helper')).toEqual(['scheduling', 'quotes']);
});

test('skipping the WorkStyle recommends the solo Team', () => {
  expect(recommendedRoles(catalog, null)).toEqual(['scheduling']);
});

test('the Trade picker shows the first Trade and how many more', () => {
  expect(tradesSummary([])).toBeUndefined();
  expect(tradesSummary(['electrical'])).toBe('Elétrica');
  expect(tradesSummary(['hvac', 'electrical', 'plumbing'])).toBe('Climatização e refrigeração +2');
});

test('searching Trades ignores case and accents', () => {
  expect(searchTrades('eletr')).toEqual(['electrical', 'appliance_repair']);
  expect(searchTrades('  ')).toHaveLength(10);
});

test('the greeting uses the first name', () => {
  expect(firstName('Carlos da Refrigeração')).toBe('Carlos');
  expect(firstName('  ')).toBeUndefined();
});

test('the Team button counts the chosen Assistants', () => {
  expect(teamButtonLabel(0)).toBe('Escolha pelo menos um');
  expect(teamButtonLabel(1)).toBe('Continuar com 1 assistente');
  expect(teamButtonLabel(3)).toBe('Continuar com 3 assistentes');
});
