import { paymentMethod } from '@acme/db';
import { t } from 'elysia';

export const WorkRecordsModel = {
  // expo-audio records M4A, which file-type reads as video/mp4 on Android.
  'workRecords.Audio': t.Object({ audio: t.File({ type: ['audio/*', 'video/mp4'], maxSize: '25m' }) }),
  'workRecords.New': t.Object({
    customerId: t.String({ format: 'uuid' }),
    visitId: t.Nullable(t.String({ format: 'uuid' })),
    description: t.String({ minLength: 1, maxLength: 2000, pattern: '\\S' }),
    materials: t.Nullable(t.String({ maxLength: 2000 })),
    amountCents: t.Integer({ minimum: 1, maximum: 100_000_000 }),
    paymentMethod: t.UnionEnum(paymentMethod.enumValues),
    // Asked only for cash: "Já recebeu?"
    received: t.Optional(t.Boolean()),
  }),
};
