import { t } from 'elysia';

export const EmulatorModel = {
  'emulator.Click': t.Object({ index: t.Integer({ minimum: 0 }) }),
  'emulator.Status': t.Object({
    status: t.Union([t.Literal('sent'), t.Literal('delivered'), t.Literal('read'), t.Literal('failed')]),
  }),
  'emulator.Reply': t.Object({ text: t.String({ minLength: 1 }) }),
};
