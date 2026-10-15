export function toPhoneNumber(typed: string) {
  const digits = typed.replace(/\D/g, '');
  const national = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (national.length === 10 || national.length === 11) return `55${national}`;
}

export function formatPhoneNumber(phoneNumber: string) {
  const match = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(phoneNumber);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phoneNumber;
}
