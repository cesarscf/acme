import { useMutation } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { authClient } from '@/lib/auth-client';
import { baseUrl } from '@/lib/base-url';

// Eden builds multipart only from a Blob, and the recording is an expo-file-system File, so it goes by hand.
async function transcribe(uri: string): Promise<{ transcript: string }> {
  const form = new FormData();
  // expo/fetch sends an expo-file-system File as a Blob; React Native's Blob type does not know it.
  form.append('audio', new File(uri) as unknown as Blob);
  const response = await fetch(`${baseUrl}/work-records/transcription`, {
    method: 'POST',
    headers: { cookie: await authClient.getCookie() },
    credentials: 'omit',
    body: form,
  });
  if (!response.ok) throw { status: response.status };
  return response.json();
}

export function useTranscriptionMutation() {
  return useMutation({ mutationFn: transcribe });
}
