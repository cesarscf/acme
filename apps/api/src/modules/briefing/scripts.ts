import type * as z from 'zod';

type Option<Value> =
  | { key: string; label: string; hint?: string; ack: string; value: Value }
  // Shown as "em breve": the integration does not exist in the MVP.
  | { key: string; label: string; hint?: string; comingSoon: true };

export type Parsed<Value> = { value: Value; ack: string } | { error: string };

// A step with a parse reads free text itself, so a Pix key never goes to Claude.
type TextAnswer<Value> =
  | { guide: string; parse?: undefined }
  | { guide?: undefined; parse: (text: string) => Parsed<Value> };

type StepDefinition<Value> = {
  key: string;
  label: string;
  pre?: string;
  question: string;
  schema: z.ZodType<Value>;
  options: Option<NoInfer<Value>>[];
  format: (value: NoInfer<Value>) => string;
  routine?: (value: NoInfer<Value>) => string | null;
} & TextAnswer<NoInfer<Value>>;

export type BriefingStep = {
  key: string;
  label: string;
  pre?: string;
  question: string;
  schema: z.ZodType;
  options: Option<unknown>[];
  guide?: string;
  parse?: (text: string) => Parsed<unknown>;
  describe: (value: unknown) => { step: string; label: string; value: string; routine: string | null } | undefined;
};

export type BriefingScript = {
  what: string;
  greeting: string;
  connect: { name: string; reason: string; availability: 'first_message' | 'coming_soon' }[];
  steps: BriefingStep[];
  testPix?: (playbook: Record<string, unknown>) => { text: string; code: string } | null;
  done: string;
};

export function step<Value>(definition: StepDefinition<Value>): BriefingStep {
  const { format, routine, ...rest } = definition;
  return {
    ...rest,
    describe: (value) => {
      const parsed = definition.schema.safeParse(value);
      if (!parsed.success) return undefined;
      return {
        step: definition.key,
        label: definition.label,
        value: format(parsed.data),
        routine: routine?.(parsed.data) ?? null,
      };
    },
  };
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
