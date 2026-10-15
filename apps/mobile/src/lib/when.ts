const time = (date: Date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// "Hoje, 15:42" as in the prototype; older days show the date.
export function formatWhen(date: Date, now = new Date()) {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return `Hoje, ${time(date)}`;
  if (days === 1) return `Ontem, ${time(date)}`;
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${time(date)}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
