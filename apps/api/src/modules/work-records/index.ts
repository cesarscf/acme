import { Elysia, status } from 'elysia';
import { auth } from '../auth';
import { hasAiConsent } from '../conversations/service';
import { transcribe } from '../transcription/transcribe';
import { WorkRecordsModel } from './model';
import {
  addMessage,
  chargeWorkRecord,
  chooseCustomer,
  confirmWorkRecordCharge,
  createWorkRecord,
  findBillingAssistant,
  getWorkRecord,
  listWorkRecords,
  recordAudioUsage,
} from './service';

export const workRecords = new Elysia()
  .use(auth)
  .model(WorkRecordsModel)
  .get('/work-records', ({ professional }) => listWorkRecords(professional.id), { auth: true })
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
  .get(
    '/work-records/:id',
    async ({ professional, params: { id } }) => {
      const workRecord = await getWorkRecord(professional.id, id);
      if (!workRecord) throw status(404, 'Work record not found');
      return workRecord;
    },
    { auth: true, params: 'workRecords.WorkRecord' },
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
  )
  .post(
    '/work-records/:id/charge',
    async ({ professional, params: { id } }) => {
      const result = await chargeWorkRecord(professional.id, id);
      if (result.workRecord) return result.workRecord;
      if (result.refused === 'work_record_not_found') throw status(404, 'Work record not found');
      if (result.refused === 'send_failed') throw status(502, 'Sending failed');
      throw status(409, result.refused);
    },
    { auth: true, params: 'workRecords.WorkRecord' },
  )
  .post(
    '/work-records/:id/charge/confirmation',
    async ({ professional, params: { id }, body: { received } }) => {
      const result = await confirmWorkRecordCharge(professional.id, id, received);
      if (result.workRecord) return result.workRecord;
      if (result.refused === 'not_found') throw status(404, 'Charge not found');
      throw status(409, result.refused);
    },
    { auth: true, params: 'workRecords.WorkRecord', body: 'workRecords.ChargeConfirmation' },
  );
