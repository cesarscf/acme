import { expect, test } from 'bun:test';
import { transcriptLines } from './transcript';

test('splits the transcript into sentences, and each thread message into its own lines', () => {
  expect(
    transcriptLines('Terminei na casa do João. Limpei o split de 12.000 BTU! Ficou 350 reais\nFoi no Pix, viu?'),
  ).toEqual(['Terminei na casa do João.', 'Limpei o split de 12.000 BTU!', 'Ficou 350 reais', 'Foi no Pix, viu?']);
});
