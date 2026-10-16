import { Elysia, status } from 'elysia';
import { auth } from '../auth';
import { hasAiConsent } from '../conversations/service';
import { transcribe } from '../transcription/transcribe';
import { matchVisit } from './match';
import { WorkRecordsModel } from './model';
import { createWorkRecord, findBillingAssistant, recordAudioUsage } from './service';

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
    '/work-records/match',
    async ({ professional, body: { transcript, visitId } }) => {
      if (!(await hasAiConsent(professional.id))) throw status(403, 'AI consent required');
      const billingAssistant = await findBillingAssistant(professional.id);
      const matched = await matchVisit(professional.id, billingAssistant?.id ?? null, transcript.trim(), visitId);
      if (!matched) throw status(404, 'Visit not found');
      return matched;
    },
    { auth: true, body: 'workRecords.Match' },
  )
  .post(
    '/work-records',
    async ({ professional, body: { transcript, ...chosen } }) => {
      if (!(await hasAiConsent(professional.id))) throw status(403, 'AI consent required');
      const result = await createWorkRecord(professional.id, transcript, chosen);
      if (result.workRecord) return result.workRecord;
      if (result.refused === 'customer_unknown') return status(409, { newCustomerName: result.newCustomerName });
      throw status(404, result.refused === 'visit_not_found' ? 'Visit not found' : 'Customer not found');
    },
    { auth: true, body: 'workRecords.New' },
  );
