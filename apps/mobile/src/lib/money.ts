// Reads what people type for an amount in reais: "350", "350,50", "R$ 1.234,56".
export function parseMoney(typed: string) {
  const cleaned = typed.replace(/[^\d,.]/g, '');
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const cents = Number(match[1]!.replaceAll('.', '')) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return cents > 0 ? cents : null;
}

export function formatMoneyInput(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
