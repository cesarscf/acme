export function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// "R$ 350" as the prototype says it in a sentence; cents only when there are any.
export function formatWholeMoney(cents: number) {
  return cents % 100 === 0 ? formatMoney(cents).replace(/,00$/, '') : formatMoney(cents);
}
