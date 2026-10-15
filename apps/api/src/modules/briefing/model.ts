import { t } from 'elysia';

const step = t.String({ minLength: 1, maxLength: 40 });

export const BriefingModel = {
  'briefing.Assistant': t.Object({ id: t.String({ format: 'uuid' }) }),
  'briefing.Answer': t.Union([
    t.Object({ step, option: t.String({ minLength: 1, maxLength: 40 }) }),
    t.Object({ step, text: t.String({ minLength: 1, maxLength: 1000, pattern: '\\S' }) }),
  ]),
  'briefing.Step': t.Object({ step }),
};
