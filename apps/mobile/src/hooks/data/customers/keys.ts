export const customerKeys = {
  all: ['customers'] as const,
  list: (query: string) => ['customers', 'list', query] as const,
  thread: (id: string) => ['customers', 'thread', id] as const,
};
