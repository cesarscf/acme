export function toPhoneNumber(typed: string) {
  const digits = typed.replace(/\D/g, '');
  const national = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (national.length === 10 || national.length === 11) return `55${national}`;
}
