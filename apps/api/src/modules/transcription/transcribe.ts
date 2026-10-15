// The only place that knows the speech-to-text provider (docs/research/speech-to-text.md).
const model = 'openai/whisper-large-v3-turbo';

export type Transcription = { text: string; seconds: number; model: string };

export async function transcribe(audio: File): Promise<Transcription> {
  const form = new FormData();
  form.append('file', audio, audio.name || 'audio.m4a');
  form.append('model', model);
  form.append('language', 'pt');
  form.append('provider', JSON.stringify({ zdr: true }));

  const response = await fetch(
    `${process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'}/audio/transcriptions`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!response.ok) throw new Error(`Transcription failed with ${response.status}: ${await response.text()}`);
  const { text, usage } = (await response.json()) as { text: string; usage?: { seconds?: number } };
  return { text: text.trim(), seconds: usage?.seconds ?? 0, model };
}
