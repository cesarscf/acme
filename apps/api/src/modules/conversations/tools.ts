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
  card?: (input: unknown) => Promise<ConfirmationCard>;
};

export function strict<Input>(tool: BetaRunnableTool<Input>) {
  return { ...tool, strict: true };
}

export function confirmed<Input>(
  tool: BetaRunnableTool<Input>,
  card: (input: Input) => Promise<ConfirmationCard>,
): AssistantTool {
  return { tool: strict(tool), card: (input) => card(tool.parse(input)) };
}

export function findTool(tools: AssistantTool[], name: string) {
  return tools.find(({ tool }) => tool.name === name);
}

export function assistantTools(assistant: Assistant): AssistantTool[] {
  return [...customerTools(assistant), ...roles[assistant.role].tools(assistant), ...threadTools(assistant)];
}
