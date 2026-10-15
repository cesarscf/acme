import { Elysia, status } from 'elysia';
import { auth } from '../auth';
import { hasAiConsent } from '../conversations/service';
import { transcribe } from '../transcription/transcribe';
import { draftWorkRecord } from './draft';
import { WorkRecordsModel } from './model';
import {
  createWorkRecord,
  findBillingAssistant,
  findPaymentMethods,
  findProfessional,
  getWorkRecordForm,
  listCustomerNames,
  listRecentVisits,
  recordAudioUsage,
} from './service';

export const workRecords = new Elysia()
  .use(auth)
  .model(WorkRecordsModel)
  .get('/work-records/new', ({ professional }) => getWorkRecordForm(professional.id), { auth: true })
  .post(
    '/work-records/draft',
    async ({ professional, body: { audio } }) => {
      if (!(await hasAiConsent(professional.id))) throw status(403, 'AI consent required');
      const billingAssistant = await findBillingAssistant(professional.id);
      let transcription: Awaited<ReturnType<typeof transcribe>>;
      try {
        transcription = await transcribe(audio);
      } catch (error) {
        console.error('Work record transcription failed', error);
        throw status(502, 'Transcription failed');
      }
      await recordAudioUsage(professional.id, billingAssistant?.id ?? null, transcription);
      if (!transcription.text) throw status(422, 'Nothing heard');
      const draft = await draftWorkRecord(
        {
          professionalId: professional.id,
          assistantId: billingAssistant?.id ?? null,
          customers: await listCustomerNames(professional.id),
          visits: await listRecentVisits(await findProfessional(professional.id)),
          paymentMethods: await findPaymentMethods(professional.id),
        },
        transcription.text,
      );
      return { transcript: transcription.text, draft };
    },
    { auth: true, body: 'workRecords.Audio' },
  )
  .post(
    '/work-records',
    async ({ professional, body }) => {
      const result = await createWorkRecord(professional.id, body);
      if ('refused' in result) {
        if (result.refused === 'customer_not_found') throw status(404, 'Customer not found');
        if (result.refused === 'visit_not_found') throw status(404, 'Visit not found');
        throw status(422, 'PaymentMethod not accepted');
      }
      return result;
    },
    { auth: true, body: 'workRecords.New' },
  );
