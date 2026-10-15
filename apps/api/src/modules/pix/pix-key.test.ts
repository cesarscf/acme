import { expect, test } from 'bun:test';
import { parsePixKey } from './pix-key';

test.each([
  ['529.982.247-25', { type: 'cpf', key: '52998224725' }],
  ['52998224725', { type: 'cpf', key: '52998224725' }],
  ['11.222.333/0001-81', { type: 'cnpj', key: '11222333000181' }],
  // Alphanumeric CNPJ, issued since July 2026 (example from the Receita Federal).
  ['12.ABC.345/01DE-35', { type: 'cnpj', key: '12ABC34501DE35' }],
  [' Carlos.Refrigeracao@Gmail.com ', { type: 'email', key: 'carlos.refrigeracao@gmail.com' }],
  ['(11) 98765-4321', { type: 'phone', key: '+5511987654321' }],
  ['+55 21 99876-5432', { type: 'phone', key: '+5521998765432' }],
  ['11987654321', { type: 'phone', key: '+5511987654321' }],
  ['123E4567-E12B-12D1-A456-426655440000', { type: 'random', key: '123e4567-e12b-12d1-a456-426655440000' }],
  ['123e4567e12b12d1a456426655440000', { type: 'random', key: '123e4567-e12b-12d1-a456-426655440000' }],
])('%p is a Pix key', (text, key) => {
  expect(parsePixKey(text)).toEqual(key as never);
});

test.each([
  ['529.982.247-24', 'Esse CPF não existe. Confira os números.'],
  ['11.222.333/0001-80', 'Esse CNPJ não existe. Confira os números.'],
  ['carlos@gmail', 'Esse e-mail está incompleto. Confira se tem o @ e o domínio, como nome@gmail.com.'],
  ['(11) 8765-4321', 'O celular precisa do DDD e dos 9 dígitos, como (11) 98765-4321.'],
  [
    '123e4567-e12b-12d1-a456-42665544000',
    'A chave aleatória tem 32 letras e números, como 123e4567-e12b-12d1-a456-426655440000.',
  ],
  [
    'pix do carlos',
    'Não reconheci essa chave. A chave Pix pode ser CPF, CNPJ, e-mail, celular com DDD ou a chave aleatória.',
  ],
])('%p is refused with an explanation', (text, error) => {
  expect(parsePixKey(text)).toEqual({ error });
});
