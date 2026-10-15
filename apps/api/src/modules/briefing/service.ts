import { assistants, db, professionals } from '@acme/db';
import { and, eq, sql } from 'drizzle-orm';
import { hasAiConsent } from '../conversations/service';
import { syncRoutines } from '../routines/service';
import type { AssistantRole } from '../team/catalog';
import { interpret } from './interpret';
import { type BriefingScript, type BriefingStep, briefingScripts } from './scripts';

type Answer = { said: string; ack: string };
type Progress = { connect?: 'later'; answers?: Record<string, Answer> };

export type BriefingAssistant = NonNullable<Awaited<ReturnType<typeof findBriefingAssistant>>>;

export async function findBriefingAssistant(professionalId: string, id: string) {
  const [row] = await db
    .select({
      id: assistants.id,
      role: assistants.role,
      name: assistants.name,
      playbook: assistants.playbook,
      playbookStatus: assistants.playbookStatus,
      briefing: assistants.briefing,
      professional: { id: professionals.id, name: professionals.name },
    })
    .from(assistants)
    .innerJoin(professionals, eq(professionals.id, assistants.professionalId))
    .where(and(eq(assistants.id, id), eq(assistants.professionalId, professionalId)));
  return row && { ...row, playbook: row.playbook as Record<string, unknown>, briefing: row.briefing as Progress };
}

export function findStep(role: AssistantRole, key: string) {
  return briefingScripts[role]?.steps.find((step) => step.key === key);
}

export function getBriefing(assistant: BriefingAssistant) {
  const script = briefingScripts[assistant.role];
  if (!script) return null;
  const answers = assistant.briefing.answers ?? {};
  const firstName = assistant.professional.name.trim().split(/\s+/)[0];
  return {
    status: assistant.playbookStatus,
    greeting: `Oi, ${firstName}! Eu sou ${assistant.name}. ${script.greeting}`,
    connect: { skipped: assistant.briefing.connect === 'later', items: script.connect },
    steps: script.steps.map((step) => ({
      key: step.key,
      label: step.label,
      pre: step.pre ?? null,
      question: step.question,
      options: step.options.map((option) => ({
        key: option.key,
        label: option.label,
        hint: option.hint ?? null,
        comingSoon: 'comingSoon' in option,
      })),
      answer: (step.key in assistant.playbook && answers[step.key]) || null,
    })),
    playbook: playbookRows(script, assistant.playbook),
    done: script.done,
  };
}

// The Ver ficha rows, or null while a step still has no valid answer.
export function playbookRows(script: BriefingScript, playbook: Record<string, unknown>) {
  const rows = script.steps.map((step) => step.describe(playbook[step.key]));
  if (rows.some((row) => !row)) return null;
  return [
    { step: null, label: 'O que faz', value: script.what, routine: null },
    ...(rows as NonNullable<(typeof rows)[number]>[]),
  ];
}

export function describePlaybook(role: AssistantRole, playbook: unknown) {
  const script = briefingScripts[role];
  const rows = script && playbookRows(script, playbook as Record<string, unknown>);
  if (!rows) return JSON.stringify(playbook);
  return rows.map(({ label, value }) => `${label}: ${value}`).join('\n');
}

export async function skipConnect(assistantId: string) {
  await db
    .update(assistants)
    .set({ briefing: sql`${assistants.briefing} || '{"connect":"later"}'::jsonb` })
    .where(eq(assistants.id, assistantId));
}

// Answering also passes the connect card, as typing an answer there means "Agora não".
async function saveAnswer(assistantId: string, step: BriefingStep, value: unknown, answer: Answer) {
  await db
    .update(assistants)
    .set({
      playbook: sql`${assistants.playbook} || jsonb_build_object(${step.key}::text, ${JSON.stringify(value)}::jsonb)`,
      briefing: sql`${assistants.briefing} || jsonb_build_object(
        'connect', 'later',
        'answers', coalesce(${assistants.briefing} -> 'answers', '{}'::jsonb) || jsonb_build_object(${step.key}::text, ${JSON.stringify(answer)}::jsonb)
      )`,
    })
    .where(eq(assistants.id, assistantId));
}

export type AnswerResult =
  | { understood: true }
  | { understood: false; reply: string }
  | { refused: 'option_not_available' | 'ai_consent_required' };

// A chip goes straight into the Playbook; free text is fitted into the step by Claude.
export async function answerStep(
  assistant: BriefingAssistant,
  step: BriefingStep,
  input: { option: string } | { text: string },
): Promise<AnswerResult> {
  if ('option' in input) {
    const option = step.options.find(({ key }) => key === input.option);
    if (!option || !('value' in option)) return { refused: 'option_not_available' };
    await saveAnswer(assistant.id, step, option.value, { said: option.label, ack: option.ack });
    await syncRoutines(assistant.id);
    return { understood: true };
  }
  if (!(await hasAiConsent(assistant.professional.id))) return { refused: 'ai_consent_required' };
  const { value, reply } = await interpret(assistant, step, input.text);
  if (value === null) return { understood: false, reply };
  await saveAnswer(assistant.id, step, value, { said: input.text, ack: reply });
  await syncRoutines(assistant.id);
  return { understood: true };
}

export async function approve(assistant: BriefingAssistant) {
  const script = briefingScripts[assistant.role];
  if (!script || !playbookRows(script, assistant.playbook)) return false;
  await db.update(assistants).set({ playbookStatus: 'approved' }).where(eq(assistants.id, assistant.id));
  await syncRoutines(assistant.id);
  return true;
}

// Desfazer: the Playbook goes back to draft and its Routines stop.
export async function undoApproval(assistantId: string) {
  await db.update(assistants).set({ playbookStatus: 'draft' }).where(eq(assistants.id, assistantId));
  await syncRoutines(assistantId);
}

export async function reopenStep(assistantId: string, step: BriefingStep) {
  await db
    .update(assistants)
    .set({
      playbook: sql`${assistants.playbook} - ${step.key}::text`,
      briefing: sql`${assistants.briefing} #- array['answers', ${step.key}::text]`,
    })
    .where(eq(assistants.id, assistantId));
}
