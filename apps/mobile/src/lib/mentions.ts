export type MentionPart = { text: string } | { mention: string };

const letter = /[\p{L}\p{N}]/u;

// The Assistants' names are what the Professional chose, so they are matched as whole words, exactly as written.
export function splitMentions(text: string, names: string[]): MentionPart[] {
  if (!names.length) return [{ text }];
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`@?(${escaped.join('|')})`, 'gu');
  const parts: MentionPart[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    const before = text[start - 1];
    const after = text[end];
    if ((before && letter.test(before)) || (after && letter.test(after))) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ mention: match[1]! });
    last = end;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}

export function withoutOpeningMention(text: string, name: string, names: string[]) {
  const [first, ...rest] = splitMentions(text, names);
  if (!first || !('mention' in first) || first.mention !== name) return text;
  return rest
    .map((part) => ('text' in part ? part.text : part.mention))
    .join('')
    .replace(/^[,:]?\s*/, '');
}
