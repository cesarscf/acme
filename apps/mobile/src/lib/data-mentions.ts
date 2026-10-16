// The @ that ask for data in the Assistants' chat; the Assistant reads what comes after as the period or the filter.
export const dataMentions = [
  { tag: '@agenda', detail: 'de hoje, de amanhã, da semana que vem' },
  { tag: '@cobranças', detail: 'em aberto' },
  { tag: '@caixa', detail: 'do mês' },
] as const;

export type DataMentionPart = { text: string } | { mention: string };

const tags = dataMentions.map(({ tag }) => tag);
const letter = /[\p{L}\p{N}]/u;

export function opensDataMenu(text: string) {
  return /(^|\s)@$/.test(text);
}

// The mention replaces the @ being typed, or goes after what is written; the space lets the Professional go on.
export function insertDataMention(text: string, tag: string) {
  if (opensDataMenu(text)) return `${text.slice(0, -1)}${tag} `;
  if (!text) return `${tag} `;
  return `${text.trimEnd()} ${tag} `;
}

export function splitDataMentions(text: string): DataMentionPart[] {
  const parts: DataMentionPart[] = [];
  const pattern = new RegExp(tags.join('|'), 'gu');
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    const before = text[start - 1];
    const after = text[end];
    if ((before && letter.test(before)) || (after && letter.test(after))) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ mention: match[0] });
    last = end;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}
