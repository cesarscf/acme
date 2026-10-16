import { Elysia, status } from 'elysia';
import { auth } from '../auth';
import { hasAiConsent } from '../conversations/service';
import { transcribe } from '../transcription/transcribe';
import { WorkRecordsModel } from './model';
import { addMessage, chooseCustomer, createWorkRecord, findBillingAssistant, recordAudioUsage } from './service';

export const workRecords = new Elysia()
  .use(auth)
  .model(WorkRecordsModel)
  .post(
    '/work-records/transcription',
    async ({ professional, body: { audio } }) => {
      if (!(await hasAiConsent(professional.id))) throw status(403, 'AI consent required');
      let transcription: Awaited<ReturnType<typeof transcribe>>;
      try {
        transcription = await transcribe(audio);
      } catch (error) {
        console.error('Work record transcription failed', error);
        throw status(502, 'Transcription failed');
      }
      const billingAssistant = await findBillingAssistant(professional.id);
      await recordAudioUsage(professional.id, billingAssistant?.id ?? null, transcription);
      if (!transcription.text) throw status(422, 'Nothing heard');
      return { transcript: transcription.text };
    },
    { auth: true, body: 'workRecords.Audio' },
  )
  .post(
    '/work-records',
    async ({ professional, body: { transcript, visitId } }) => {
      if (!(await hasAiConsent(professional.id))) throw status(403, 'AI consent required');
      const workRecord = await createWorkRecord(professional.id, transcript, visitId);
      if (!workRecord) throw status(404, 'Visit not found');
      return workRecord;
    },
    { auth: true, body: 'workRecords.New' },
  )
  .post(
    '/work-records/:id/messages',
    async ({ professional, params: { id }, body: { text } }) => {
      if (!(await hasAiConsent(professional.id))) throw status(403, 'AI consent required');
      const workRecord = await addMessage(professional.id, id, text);
      if (!workRecord) throw status(404, 'Work record not found');
      return workRecord;
    },
    { auth: true, params: 'workRecords.WorkRecord', body: 'workRecords.Message' },
  )
  .patch(
    '/work-records/:id',
    async ({ professional, params: { id }, body: { customerId } }) => {
      const result = await chooseCustomer(professional.id, id, customerId);
      if ('refused' in result) {
        throw status(404, result.refused === 'customer_not_found' ? 'Customer not found' : 'Work record not found');
      }
      return result.workRecord;
    },
    { auth: true, params: 'workRecords.WorkRecord', body: 'workRecords.Customer' },
  );
