import { Elysia, status } from 'elysia';
import { auth } from '../auth';
import { BriefingModel } from './model';
import { answerStep, approve, findBriefingAssistant, findStep, getBriefing, reopenStep, skipConnect } from './service';

export const briefing = new Elysia()
  .use(auth)
  .model(BriefingModel)
  .get(
    '/team/:id/briefing',
    async ({ professional, params: { id } }) => {
      const assistant = await findBriefingAssistant(professional.id, id);
      if (!assistant) throw status(404, 'Assistant not found');
      const briefing = getBriefing(assistant);
      if (!briefing) throw status(404, 'No Briefing for this Role');
      return briefing;
    },
    { auth: true, params: 'briefing.Assistant' },
  )
  .post(
    '/team/:id/briefing/connect',
    async ({ professional, params: { id } }) => {
      const assistant = await findBriefingAssistant(professional.id, id);
      if (!assistant) throw status(404, 'Assistant not found');
      await skipConnect(assistant.id);
    },
    { auth: true, params: 'briefing.Assistant' },
  )
  .post(
    '/team/:id/briefing/answers',
    async ({ professional, params: { id }, body }) => {
      const assistant = await findBriefingAssistant(professional.id, id);
      if (!assistant) throw status(404, 'Assistant not found');
      const step = findStep(assistant.role, body.step);
      if (!step) throw status(404, 'Step not found');
      const result = await answerStep(assistant, step, body);
      if ('refused' in result) {
        if (result.refused === 'ai_consent_required') throw status(403, 'AI consent required');
        throw status(422, 'Option not available');
      }
      return result;
    },
    { auth: true, params: 'briefing.Assistant', body: 'briefing.Answer' },
  )
  .post(
    '/team/:id/briefing/approve',
    async ({ professional, params: { id } }) => {
      const assistant = await findBriefingAssistant(professional.id, id);
      if (!assistant) throw status(404, 'Assistant not found');
      if (!(await approve(assistant))) throw status(409, 'Playbook has steps left');
    },
    { auth: true, params: 'briefing.Assistant' },
  )
  .post(
    '/team/:id/briefing/adjust',
    async ({ professional, params: { id }, body }) => {
      const assistant = await findBriefingAssistant(professional.id, id);
      if (!assistant) throw status(404, 'Assistant not found');
      const step = findStep(assistant.role, body.step);
      if (!step) throw status(404, 'Step not found');
      // An approved Playbook changes field by field from Ver ficha and stays approved.
      if (assistant.playbookStatus === 'approved') throw status(409, 'Playbook already approved');
      await reopenStep(assistant.id, step);
    },
    { auth: true, params: 'briefing.Assistant', body: 'briefing.Step' },
  );
