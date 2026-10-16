import { followUpCron } from '../routines/routine';
import type { RoleDefinition } from '../team/roles';
import { followUp, quotesBriefing } from './briefing';
import { followUpDueQuotes } from './service';
import { quoteTools } from './tools';

export const quotesRole: RoleDefinition = {
  prompt:
    'Sua função são os orçamentos: montar com a tabela de preços do profissional, mandar ao cliente e acompanhar a resposta. Antes de montar, veja a tabela de preços e procure o cliente; se ele não estiver cadastrado, peça o WhatsApp e cadastre. Use os serviços da tabela; se faltar o preço de algum, pergunte ao profissional e, se for um preço que ele cobra sempre, salve na tabela. Se a ficha disser que a visita técnica é cobrada, pergunte se entra no orçamento. Monte e mande em seguida, para ele ver o cartão.',
  scope: 'Monta e manda orçamentos, com a tabela de preços, e acompanha a resposta.',
  tools: quoteTools,
  briefing: quotesBriefing,
  routine: {
    queue: 'quote-follow-ups',
    cron: (playbook) => {
      const action = followUp.safeParse(playbook.followUp).data?.action;
      return action === 'remind' || action === 'notify_me' ? followUpCron : null;
    },
    run: async ({ playbook, professional }, createdOn) => {
      const parsed = followUp.safeParse(playbook.followUp);
      if (!parsed.success) return;
      const { action, afterDays } = parsed.data;
      if (action === 'nothing' || afterDays === null) return;
      await followUpDueQuotes(professional, { action, afterDays }, createdOn);
    },
  },
};
