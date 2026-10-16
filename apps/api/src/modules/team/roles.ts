import type { BriefingScript } from '../briefing/scripts';
import { billingRole } from '../charges/role';
import type { TimedItems } from '../conversations/history';
import type { Assistant } from '../conversations/service';
import type { AssistantTool } from '../conversations/tools';
import { quotesRole } from '../quotes/role';
import type { Routine } from '../routines/routine';
import { schedulingRole } from '../visits/role';
import type { AssistantRole } from './catalog';

// Everything a Role does lives in its module; the Catalog keeps only the name and mascot.
export type RoleDefinition = {
  prompt: string;
  // How the router tells this Role apart in a Customer's thread.
  scope: string;
  tools: (assistant: Assistant) => AssistantTool[];
  briefing: BriefingScript;
  routine: Routine;
  // Texts of the one-tap suggestion a notice to this Role can carry.
  suggestion?: { question: (customerName: string) => string; message: (customerName: string) => string };
  // Items only this Role's chat shows, each at its own time.
  timeline?: (assistant: Assistant) => Promise<TimedItems[]>;
};

export const roles: Record<AssistantRole, RoleDefinition> = {
  scheduling: schedulingRole,
  quotes: quotesRole,
  billing: billingRole,
};
