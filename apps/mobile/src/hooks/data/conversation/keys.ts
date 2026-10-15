export const conversationKeys = {
  detail: (assistantId: string) => ['conversation', assistantId] as const,
};
