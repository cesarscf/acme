import { t } from 'elysia';

const text = (maxLength: number) => t.String({ minLength: 1, maxLength, pattern: '\\S' });

export const WorkRecordsModel = {
  // expo-audio records M4A, which file-type reads as video/mp4 on Android.
  'workRecords.Audio': t.Object({ audio: t.File({ type: ['audio/*', 'video/mp4'], maxSize: '25m' }) }),
  // Where the account goes: a Visit, a Customer, or (customer) the name and WhatsApp of one not found yet.
  'workRecords.New': t.Object({
    transcript: text(20_000),
    visitId: t.Optional(t.String({ format: 'uuid' })),
    customerId: t.Optional(t.String({ format: 'uuid' })),
    customer: t.Optional(text(500)),
  }),
  'workRecords.Match': t.Object({ transcript: text(20_000), visitId: t.Optional(t.String({ format: 'uuid' })) }),
};
