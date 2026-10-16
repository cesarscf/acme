import { t } from 'elysia';

const text = (maxLength: number) => t.String({ minLength: 1, maxLength, pattern: '\\S' });

export const WorkRecordsModel = {
  // expo-audio records M4A, which file-type reads as video/mp4 on Android.
  'workRecords.Audio': t.Object({ audio: t.File({ type: ['audio/*', 'video/mp4'], maxSize: '25m' }) }),
  'workRecords.New': t.Object({ transcript: text(20_000), visitId: t.Optional(t.String({ format: 'uuid' })) }),
  'workRecords.Message': t.Object({ text: text(2000) }),
  'workRecords.WorkRecord': t.Object({ id: t.String({ format: 'uuid' }) }),
  'workRecords.Customer': t.Object({ customerId: t.String({ format: 'uuid' }) }),
};
