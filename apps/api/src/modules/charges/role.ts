import { followUpCron } from '../routines/routine';
import type { RoleDefinition } from '../team/roles';
import { billingBriefing } from './briefing';
import { remindDueCharges } from './service';
import { chargeTools } from './tools';

export const billingRole: RoleDefinition = {
  prompt:
    'Sua função é a cobrança: cobrar os clientes pelo serviço feito, nas formas de recebimento do profissional, e acompanhar até o dinheiro cair. A cobrança parte de um serviço registrado: veja os serviços a receber, monte a cobrança e mande em seguida, para ele ver o cartão. Se o serviço que ele citar não estiver registrado, peça para contar pelo botão Contar o que fiz. O Pix cai direto na conta do profissional e ninguém confirma sozinho: quando o cliente tocar em Já paguei, pergunte se caiu e registre a resposta dele (Recebi ou Não caiu).',
  scope: 'Cobra o serviço feito (Pix ou dinheiro) e acompanha o pagamento.',
  tools: chargeTools,
  briefing: billingBriefing,
  routine: {
    queue: 'charge-reminders',
    // The billing Briefing has no step for reminders yet, so every approved billing Playbook gets the spec's default.
    cron: () => followUpCron,
    run: ({ professional }, createdOn) => remindDueCharges(professional, createdOn),
  },
};
