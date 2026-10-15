import { afterAll, expect, test } from 'bun:test';
import { startFakeOpenRouter } from './fake-openrouter';
import { transcribe } from './transcribe';

const openRouter = startFakeOpenRouter();
const audio = new File([await Bun.file(`${import.meta.dir}/fixtures/silence.m4a`).arrayBuffer()], 'audio.m4a', {
  type: 'audio/mp4',
});

afterAll(() => openRouter.stop());

test('Whisper on OpenRouter transcribes in Portuguese, only through providers that keep nothing', async () => {
  openRouter.transcribe(' Troquei o capacitor. ', 3.5);

  const transcription = await transcribe(audio);

  expect(transcription).toEqual({ text: 'Troquei o capacitor.', seconds: 3.5, model: 'openai/whisper-large-v3-turbo' });
  const request = openRouter.requests.at(-1)!;
  expect(request.get('model')).toBe('openai/whisper-large-v3-turbo');
  expect(request.get('language')).toBe('pt');
  expect(JSON.parse(request.get('provider') as string)).toEqual({ zdr: true });
  expect((request.get('file') as File).size).toBe(audio.size);
});

test('a provider error is thrown', async () => {
  openRouter.fail(503);

  expect(transcribe(audio)).rejects.toThrow('503');
});
