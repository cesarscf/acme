export function transcriptLines(transcript: string) {
  return transcript
    .split('\n')
    .flatMap((paragraph) => paragraph.match(/(?:[^.!?]|[.!?](?!\s|$))+(?:[.!?]+|$)/g) ?? [])
    .map((line) => line.trim())
    .filter(Boolean);
}
