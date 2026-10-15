export function apiUrl({ explicit, metroHost }: { explicit?: string; metroHost?: string }) {
  if (explicit) return explicit;
  const host = metroHost?.split(':')[0] ?? 'localhost';
  return `http://${host}:3000`;
}
