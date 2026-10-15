import qrcode from 'qrcode-generator';

// One SVG path with a unit square per dark module, so the QR Code draws in a single element.
export function qrCodePath(text: string) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let path = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) if (qr.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`;
  }
  return { size, path };
}
