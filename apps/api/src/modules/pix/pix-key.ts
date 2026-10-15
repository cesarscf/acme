export const pixKeyTypes = ['cpf', 'cnpj', 'email', 'phone', 'random'] as const;
export type PixKey = { type: (typeof pixKeyTypes)[number]; key: string };

const errors = {
  cpf: 'Esse CPF não existe. Confira os números.',
  cnpj: 'Esse CNPJ não existe. Confira os números.',
  email: 'Esse e-mail está incompleto. Confira se tem o @ e o domínio, como nome@gmail.com.',
  phone: 'O celular precisa do DDD e dos 9 dígitos, como (11) 98765-4321.',
  random: 'A chave aleatória tem 32 letras e números, como 123e4567-e12b-12d1-a456-426655440000.',
  unknown: 'Não reconheci essa chave. A chave Pix pode ser CPF, CNPJ, e-mail, celular com DDD ou a chave aleatória.',
};

export function parsePixKey(text: string): PixKey | { error: string } {
  const trimmed = text.trim();

  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 77
      ? { type: 'email', key: email }
      : { error: errors.email };
  }

  const random = trimmed
    .toLowerCase()
    .replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/, '$1-$2-$3-$4-$5');
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(random))
    return { type: 'random', key: random };
  if (/^[0-9a-f-]{30,40}$/i.test(trimmed) && /[a-f]/i.test(trimmed)) return { error: errors.random };

  const compact = trimmed.replace(/[\s.\-/()]/g, '').toUpperCase();

  if (/^[0-9A-Z]{12}\d{2}$/.test(compact) && /[A-Z]/.test(compact))
    return validCnpj(compact) ? { type: 'cnpj', key: compact } : { error: errors.cnpj };
  if (!/^\+?\d+$/.test(compact)) return { error: errors.unknown };

  const digits = compact.replace('+', '');
  if (trimmed.startsWith('+') || trimmed.includes('(')) return phone(digits);
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(trimmed)) return cpf(digits);
  if (digits.length === 11) {
    if (validCpf(digits)) return { type: 'cpf', key: digits };
    return digits[2] === '9' ? phone(digits) : { error: errors.cpf };
  }
  if (digits.length === 14) return validCnpj(digits) ? { type: 'cnpj', key: digits } : { error: errors.cnpj };
  if (digits.length === 10 || digits.length === 13) return phone(digits);
  return { error: errors.unknown };
}

function cpf(digits: string): PixKey | { error: string } {
  return validCpf(digits) ? { type: 'cpf', key: digits } : { error: errors.cpf };
}

function phone(digits: string): PixKey | { error: string } {
  const national = digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits;
  return /^[1-9]\d9\d{8}$/.test(national) ? { type: 'phone', key: `+55${national}` } : { error: errors.phone };
}

function validCpf(digits: string) {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
  const check = (length: number) => {
    const sum = [...digits.slice(0, length)].reduce(
      (total, digit, index) => total + Number(digit) * (length + 1 - index),
      0,
    );
    return ((sum * 10) % 11) % 10;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

// Alphanumeric CNPJs use the same check digits, with each character worth its ASCII code minus 48.
function validCnpj(value: string) {
  if (/^(\d)\1+$/.test(value)) return false;
  const check = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = [...value.slice(0, length)].reduce(
      (total, char, index) => total + (char.charCodeAt(0) - 48) * weights[index]!,
      0,
    );
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };
  return check(12) === Number(value[12]) && check(13) === Number(value[13]);
}

const typeNames = { cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', phone: 'Celular', random: 'Chave aleatória' } as const;

export function formatPixKey({ type, key }: PixKey) {
  const shown =
    type === 'cpf'
      ? key.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
      : type === 'cnpj'
        ? key.replace(/^(\w{2})(\w{3})(\w{3})(\w{4})(\d{2})$/, '$1.$2.$3/$4-$5')
        : type === 'phone'
          ? key.replace(/^\+55(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
          : key;
  return `${typeNames[type]} ${shown}`;
}
