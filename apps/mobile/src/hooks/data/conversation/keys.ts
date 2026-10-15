export const conversationKeys = {
  all: ['conversation'] as const,
  detail: (assistantId: string) => ['conversation', assistantId] as const,
};
