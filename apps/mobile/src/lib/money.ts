export function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatWholeMoney(cents: number) {
  return cents % 100 === 0 ? formatMoney(cents).replace(/,00$/, '') : formatMoney(cents);
}
