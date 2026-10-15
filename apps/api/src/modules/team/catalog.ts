import type { assistantRole, workStyle } from '@acme/db';

export type AssistantRole = (typeof assistantRole.enumValues)[number];
type WorkStyle = (typeof workStyle.enumValues)[number];

export type MascotShape = 'blob' | 'triangle' | 'hexagon' | 'square' | 'slab' | 'pill' | 'drop' | 'circle';
export type Mascot = { shape: MascotShape; color: string; light: string };

type Entry = {
  name: string;
  title: string;
  tagline: string;
  mascot: Mascot;
  recommendedFor: WorkStyle[];
};

export type CatalogEntry =
  | (Entry & { role: AssistantRole; available: true })
  | (Entry & { role: string; available: false });

const everyWorkStyle: WorkStyle[] = ['solo', 'with_helper', 'with_crew'];

// ADR 0007: the Catalog is code. Coming soon Roles are shown disabled and never become an Assistant.
export const catalog: CatalogEntry[] = [
  {
    role: 'scheduling',
    available: true,
    name: 'Lia',
    title: 'Agenda',
    tagline: 'Marca as visitas',
    mascot: { shape: 'blob', color: '#5B8DEF', light: '#B5CCFF' },
    recommendedFor: everyWorkStyle,
  },
  {
    role: 'quotes',
    available: true,
    name: 'Olga',
    title: 'Orçamentos',
    tagline: 'Faz os orçamentos',
    mascot: { shape: 'triangle', color: '#F2994A', light: '#FFD3A8' },
    recommendedFor: everyWorkStyle,
  },
  {
    role: 'billing',
    available: true,
    name: 'Tina',
    title: 'Cobrança',
    tagline: 'Cobra no Pix',
    mascot: { shape: 'hexagon', color: '#34B27B', light: '#A6EBC9' },
    recommendedFor: everyWorkStyle,
  },
  {
    role: 'routes',
    available: false,
    name: 'Beto',
    title: 'Rotas',
    tagline: 'Monta a rota do dia',
    mascot: { shape: 'slab', color: '#EDB82A', light: '#FFE79C' },
    recommendedFor: ['with_helper', 'with_crew'],
  },
  {
    role: 'inventory',
    available: false,
    name: 'Edu',
    title: 'Estoque',
    tagline: 'Cuida do material',
    mascot: { shape: 'square', color: '#8B6CF0', light: '#D0C2FF' },
    recommendedFor: ['with_helper', 'with_crew'],
  },
  {
    role: 'crew',
    available: false,
    name: 'Gil',
    title: 'Equipe',
    tagline: 'Organiza o seu pessoal',
    mascot: { shape: 'drop', color: '#7D8696', light: '#CDD2DA' },
    recommendedFor: ['with_helper', 'with_crew'],
  },
  {
    role: 'finance',
    available: false,
    name: 'Fábio',
    title: 'Financeiro',
    tagline: 'Mostra quanto sobrou',
    mascot: { shape: 'circle', color: '#25AEBB', light: '#A8EBF1' },
    recommendedFor: ['with_crew'],
  },
  {
    role: 'tax_receipts',
    available: false,
    name: 'Nina',
    title: 'Notas fiscais',
    tagline: 'Emite as notas',
    mascot: { shape: 'pill', color: '#EC6FA6', light: '#FFC4DE' },
    recommendedFor: ['with_crew'],
  },
  {
    role: 'relationship',
    available: false,
    name: 'Duda',
    title: 'Relacionamento',
    tagline: 'Chama o cliente de volta',
    mascot: { shape: 'blob', color: '#F07467', light: '#FFC6BF' },
    recommendedFor: ['with_crew'],
  },
];

export function catalogEntry(role: AssistantRole) {
  const entry = catalog.find((entry) => entry.available && entry.role === role);
  if (!entry) throw new Error(`Role ${role} is not in the Catalog`);
  return entry;
}
