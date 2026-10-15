import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { queryClient } from '@/lib/query-client';

export function useSignOutMutation() {
  return useMutation({
    mutationFn: () => authClient.signOut(),
    // Nothing cached may leak into the next Professional's session.
    onSuccess: () => queryClient.clear(),
  });
}
