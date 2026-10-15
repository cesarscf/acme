import { runRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { treaty } from '@elysia/eden';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import type { AssistantRole } from '../team/catalog';
import { findAssistant } from './service';
import type { AssistantTool } from './tools';

const api = treaty(app);

// Test-only: an Assistant as the conversation sees it, for running its tools without Claude.
export async function newAssistant(role: AssistantRole = 'scheduling') {
  const { professional, headers } = await signInNewProfessional();
  await api.team.post({ roles: [role] }, { headers });
  const { data: team } = await api.team.get({ headers });
  return (await findAssistant(professional.id, team![0]!.id))!;
}

export async function runTool(tools: AssistantTool[], name: string, input: object) {
  const entry = tools.find(({ tool }) => tool.name === name);
  if (!entry) throw new Error(`No tool named ${name}`);
  const toolUse = { type: 'tool_use' as const, id: `toolu_${crypto.randomUUID()}`, name, input, caller: undefined };
  const { content, isError } = await runRunnableTool(entry.tool, input, { toolUse, toolUseBlock: toolUse } as never);
  return { text: typeof content === 'string' ? content : JSON.stringify(content), isError };
}
