// The Pix copia-e-cola (BR Code, EMV MPM) for a key of the Professional's own bank account (ADR 0005).
export function pixBrCode({
  key,
  name,
  city,
  amountCents,
  txid = '***',
}: {
  key: string;
  name: string;
  city: string;
  amountCents?: number;
  txid?: string;
}) {
  const payload = [
    field('00', '01'),
    field('26', field('00', 'br.gov.bcb.pix') + field('01', key)),
    field('52', '0000'),
    field('53', '986'),
    amountCents === undefined ? '' : field('54', (amountCents / 100).toFixed(2)),
    field('58', 'BR'),
    field('59', ascii(name).slice(0, 25).trim()),
    field('60', ascii(city).slice(0, 15).trim()),
    field('62', field('05', txid)),
    '6304',
  ].join('');
  return payload + crc16(payload);
}

function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

// Bank apps reject accents in the name and city.
function ascii(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// CRC16-CCITT-FALSE, as the BR Code manual requires.
function crc16(payload: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
