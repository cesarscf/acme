import { expect, test } from 'bun:test';
import { hasError, parsePix } from 'pix-utils';
import { pixBrCode } from './br-code';

test('matches the static BR Code example from the Banco Central manual', () => {
  const code = pixBrCode({ key: '123e4567-e12b-12d1-a456-426655440000', name: 'Fulano de Tal', city: 'BRASILIA' });

  expect(code).toBe(
    '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
  );
});

test('a test charge of R$ 0,01 is a BR Code a decoder reads back', () => {
  const code = pixBrCode({ key: '+5511987654321', name: 'José Antônio', city: 'São Paulo', amountCents: 1 });

  const pix = parsePix(code);

  // parsePix checks the CRC and returns an error for a code a bank app would reject.
  expect(hasError(pix)).toBe(false);
  expect(pix).toMatchObject({
    type: 'STATIC',
    pixKey: '+5511987654321',
    merchantName: 'Jose Antonio',
    merchantCity: 'Sao Paulo',
    transactionAmount: 0.01,
    transactionCurrency: '986',
    countryCode: 'BR',
  });
});

test('the name and the city are cut to the size the BR Code allows', () => {
  const code = pixBrCode({
    key: 'carlos@example.com',
    name: 'Carlos Eduardo da Silva Refrigeração',
    city: 'São José dos Campos',
    amountCents: 35000,
    txid: 'CHARGE42',
  });

  expect(parsePix(code)).toMatchObject({
    merchantName: 'Carlos Eduardo da Silva R',
    merchantCity: 'Sao Jose dos Ca',
    transactionAmount: 350,
    txid: 'CHARGE42',
  });
});
