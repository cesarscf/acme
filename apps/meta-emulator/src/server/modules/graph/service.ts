import { randomUUID } from 'node:crypto';
import { reportStatus } from '../../statuses';
import { type Button, type Message, newWamid, nowInSeconds, type Store, type Template } from '../../store';
import type { Webhooks } from '../../webhooks';
import type { CreateTemplate, SendMessage } from './model';

type Content = Pick<Message, 'header' | 'body' | 'footer' | 'buttons'>;
type TemplateSend = Extract<SendMessage, { type: 'template' }>['template'];

export function graphError(code: number, message: string) {
  return { error: { message: `(#${code}) ${message}`, type: 'OAuthException', code, fbtrace_id: 'emulator' } };
}

export function sendMessage(store: Store, webhooks: Webhooks, phoneNumberId: string, send: SendMessage) {
  const template =
    send.type === 'template'
      ? store.templates.find(
          ({ name, language }) => name === send.template.name && language === send.template.language.code,
        )
      : undefined;
  const content = send.type === 'template' ? template && renderTemplate(template, send.template) : renderMessage(send);
  if (!content) return null;

  const message: Message = {
    id: newWamid(),
    direction: 'outbound',
    phoneNumberId,
    waId: send.to.replace(/\D/g, ''),
    timestamp: nowInSeconds(),
    category: template ? (template.category.toLowerCase() as Lowercase<Template['category']>) : 'service',
    bizOpaqueCallbackData: send.biz_opaque_callback_data,
    ...content,
  };
  store.messages.push(message);
  store.onChange();

  // Meta reports statuses after answering the send, so the API has stored the wamid before they arrive.
  setTimeout(() => {
    reportStatus(store, webhooks, message, 'sent');
    reportStatus(store, webhooks, message, 'delivered');
  }, 200);

  return {
    messaging_product: 'whatsapp' as const,
    contacts: [{ input: send.to, wa_id: message.waId }],
    messages: [template ? { id: message.id, message_status: 'accepted' as const } : { id: message.id }],
  };
}

// Meta answers a variable without a sample value with this subcode instead of a validation message.
export function missingExampleError(componentType: string) {
  const title = 'Message template "components" param is missing expected field(s)';
  return {
    error: {
      message: 'Invalid parameter',
      type: 'OAuthException',
      code: 100,
      error_subcode: 2388043,
      is_transient: false,
      error_user_title: title,
      error_user_msg: `${title}. component of type ${componentType} is missing expected field(s) (example)`,
      fbtrace_id: 'emulator',
    },
  };
}

export function componentMissingExample({ components }: CreateTemplate) {
  const variables = (text?: string) => new Set(text?.match(/\{\{[^}]+\}\}/g)).size;
  return components.find(({ type, text, example, buttons }) => {
    if (type === 'HEADER') return variables(text) > (example?.header_text?.length ?? 0);
    if (type === 'BODY') return variables(text) > (example?.body_text?.[0]?.length ?? 0);
    if (type === 'BUTTONS') return buttons?.some(({ url, example }) => variables(url) > (example?.length ?? 0));
    return false;
  })?.type;
}

export function createTemplate(store: Store, wabaId: string, definition: CreateTemplate) {
  const template = { ...definition, id: randomUUID(), wabaId, status: 'APPROVED' as const };
  store.templates.push(template);
  return { id: template.id, status: template.status, category: template.category };
}

// Meta's docs leave the name filter's matching unspecified, so the emulator takes the looser reading: contains.
export function listTemplates(store: Store, wabaId: string, name?: string) {
  const templates = store.templates.filter(
    (template) => template.wabaId === wabaId && (!name || template.name.includes(name)),
  );
  return { data: templates.map(({ wabaId: _, ...template }) => template) };
}

function renderMessage(send: Exclude<SendMessage, { type: 'template' }>): Content {
  if (send.type === 'text') return { body: send.text.body, buttons: [] };
  const { header, body, footer, action } = send.interactive;
  return {
    header: header?.text,
    body: body.text,
    footer: footer?.text,
    buttons: action.buttons.map(({ reply }) => ({ kind: 'reply', text: reply.title, payload: reply.id })),
  };
}

function renderTemplate(template: Template, send: TemplateSend): Content {
  const parameters = (type: 'header' | 'body') =>
    send.components?.flatMap((component) =>
      component.type === type ? component.parameters.map((parameter) => parameter.text) : [],
    ) ?? [];
  const fill = (text: string | undefined, values: string[]) =>
    text?.replace(/\{\{(\d+)\}\}/g, (match, position) => values[Number(position) - 1] ?? match);
  const component = (type: string) => template.components.find((c) => c.type === type);

  const body = component('BODY');
  const footer = component('FOOTER');
  const buttons: Button[] = (component('BUTTONS')?.buttons ?? []).map((button, index) => {
    const sent = send.components?.find((c) => c.type === 'button' && Number(c.index) === index);
    const parameter = sent?.type === 'button' ? sent.parameters[0] : undefined;
    const payload = parameter && (parameter.type === 'payload' ? parameter.payload : parameter.text);
    if (button.type === 'OTP') return { kind: 'copy_code', text: button.text ?? 'Copiar código', payload };
    return { kind: 'quick_reply', text: button.text ?? '', payload };
  });

  // Meta writes the text of authentication templates itself; this mimics its pt_BR wording.
  if (template.category === 'AUTHENTICATION') {
    const security = body?.add_security_recommendation ? ' Para sua segurança, não o compartilhe.' : '';
    const minutes = footer?.code_expiration_minutes;
    return {
      body: `*${parameters('body')[0] ?? ''}* é seu código de verificação.${security}`,
      footer: minutes ? `Este código expira em ${minutes} minutos.` : undefined,
      buttons,
    };
  }

  return {
    header: fill(component('HEADER')?.text, parameters('header')),
    body: fill(body?.text, parameters('body')) ?? '',
    footer: footer?.text,
    buttons,
  };
}
