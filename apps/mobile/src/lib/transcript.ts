// One "Você" line per sentence, as the prototype shows the transcript.
export function transcriptLines(transcript: string) {
  return transcript
    .split('\n')
    .flatMap((paragraph) => paragraph.match(/(?:[^.!?]|[.!?](?!\s|$))+(?:[.!?]+|$)/g) ?? [])
    .map((line) => line.trim())
    .filter(Boolean);
}
