import { randomBytes } from 'node:crypto';
import type { EmulatorModel } from './modules/emulator/model';
import type { CreateTemplate } from './modules/graph/model';

export type Button = { kind: 'quick_reply' | 'reply' | 'copy_code'; text: string; payload?: string };

export type Template = CreateTemplate & { id: string; wabaId: string; status: 'APPROVED' };

export type DeliveryStatus = (typeof EmulatorModel)['emulator.Status']['static']['status'];

export type Message = {
  id: string;
  direction: 'outbound' | 'inbound';
  phoneNumberId: string;
  waId: string;
  timestamp: number;
  header?: string;
  body: string;
  footer?: string;
  buttons: Button[];
  status?: DeliveryStatus;
  category?: 'utility' | 'marketing' | 'authentication' | 'service';
  bizOpaqueCallbackData?: string;
  contextId?: string;
  webhook?: { body: string; status: number | null };
};

export type Store = ReturnType<typeof createStore>;

export function createStore() {
  return {
    messages: [] as Message[],
    templates: [] as Template[],
    onChange: () => {},
  };
}

export function newWamid() {
  return `wamid.${randomBytes(24).toString('base64url')}`;
}

export function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}
