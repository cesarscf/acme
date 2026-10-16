import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { customerTools, threadTools } from '../customers/tools';
import { roles } from '../team/roles';
import type { Assistant } from './service';

export type ConfirmationCard = {
  title: string;
  subtitle: string;
  rows: { label: string; value: string }[];
  notices: string[];
  question: string;
};

// A tool with a card only runs after the Professional taps Confirmar on it.
export type AssistantTool = {
  tool: BetaRunnableTool;
  // What the app shows while the Assistant calls the tool; never sent to Claude.
  status: string;
  // A sharper status once the call's input is complete.
  inputStatus?: (input: unknown) => string | undefined;
  card?: (input: unknown) => Promise<ConfirmationCard>;
};

export function strict<Input>(tool: BetaRunnableTool<Input>) {
  return { ...tool, strict: true };
}

export function confirmed<Input>(
  status: string,
  tool: BetaRunnableTool<Input>,
  card: (input: Input) => Promise<ConfirmationCard>,
): AssistantTool {
  return { tool: strict(tool), status, card: (input) => card(tool.parse(input)) };
}

export function findTool(tools: AssistantTool[], name: string) {
  return tools.find(({ tool }) => tool.name === name);
}

export function assistantTools(assistant: Assistant): AssistantTool[] {
  return [...customerTools(assistant), ...roles[assistant.role].tools(assistant), ...threadTools(assistant)];
}
