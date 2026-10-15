import { expect, test } from 'bun:test';
import { qrCodePath } from './qr-code';

test('draws the QR Code of a Pix code as one path of unit squares, with the finder pattern in the corner', () => {
  const { size, path } = qrCodePath(
    '00020101021126400014br.gov.bcb.pix0118carlos@example.com5204000053039865406350.005802BR',
  );

  expect(size).toBeGreaterThanOrEqual(21);
  expect((size - 17) % 4).toBe(0);
  expect(path).toStartWith('M0 0h1v1h-1z');
  expect(path).toContain(`M6 6h1v1h-1z`);
  expect(path).not.toContain(`M7 0h1v1h-1z`);
});
