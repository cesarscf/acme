export const workRecordKeys = {
  all: ['work-records'] as const,
  detail: (id: string) => ['work-records', 'detail', id] as const,
};
