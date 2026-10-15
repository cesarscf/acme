import type { CatalogEntry } from '@/hooks/data/catalog/use-catalog-query';
import type { Trade, WorkStyle } from '@/hooks/data/professional/use-professional-query';

export const trades: { trade: Trade; label: string }[] = [
  { trade: 'hvac', label: 'Climatização e refrigeração' },
  { trade: 'electrical', label: 'Elétrica' },
  { trade: 'plumbing', label: 'Hidráulica' },
  { trade: 'maintenance', label: 'Manutenção e pequenas reformas' },
  { trade: 'pest_control', label: 'Dedetização e controle de pragas' },
  { trade: 'cleaning', label: 'Limpeza (casas, estofados, caixas d’água)' },
  { trade: 'gardening_and_pools', label: 'Jardinagem e piscinas' },
  { trade: 'installation', label: 'Instalação (câmeras, antenas, internet, solar)' },
  { trade: 'appliance_repair', label: 'Assistência técnica de eletrodomésticos' },
  { trade: 'other', label: 'Outro' },
];

export const workStyles: { workStyle: WorkStyle; title: string; description: string; people: number }[] = [
  { workStyle: 'solo', title: 'Sozinho', description: 'Eu faço tudo', people: 1 },
  { workStyle: 'with_helper', title: 'Com ajudante', description: 'Eu e mais 1 ou 2', people: 2 },
  { workStyle: 'with_crew', title: 'Com equipe', description: '3 ou mais pessoas em campo', people: 3 },
];

export function recommendedRoles(catalog: CatalogEntry[], workStyle: WorkStyle | null) {
  return catalog.flatMap((entry) =>
    entry.available && entry.recommendedFor.includes(workStyle ?? 'solo') ? [entry.role] : [],
  );
}

export function tradesSummary(chosen: Trade[]) {
  const [first] = chosen;
  if (!first) return;
  const label = trades.find(({ trade }) => trade === first)!.label;
  return chosen.length > 1 ? `${label} +${chosen.length - 1}` : label;
}

export function searchTrades(query: string) {
  const wanted = normalize(query.trim());
  return trades.filter(({ label }) => normalize(label).includes(wanted)).map(({ trade }) => trade);
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || undefined;
}

export function teamButtonLabel(count: number) {
  if (count === 0) return 'Escolha pelo menos um';
  return `Continuar com ${count} ${count > 1 ? 'assistentes' : 'assistente'}`;
}

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
