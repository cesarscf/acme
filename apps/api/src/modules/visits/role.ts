import type { RoleDefinition } from '../team/roles';
import { confirmations, schedulingBriefing } from './briefing';
import { requestDueVisitConfirmations } from './service';
import { localDate, nextDay, toInstant } from './time';
import { visitTools } from './tools';

export const schedulingRole: RoleDefinition = {
  prompt:
    'Sua função é a agenda: marcar, remarcar e cancelar as visitas do profissional aos clientes, e confirmar com eles na véspera. Antes de marcar, procure o cliente; se ele não estiver cadastrado, peça o WhatsApp e cadastre. Dias e horários são sempre no fuso do profissional. Se o horário bater com outra visita, avise e pergunte se marca mesmo assim; não marque por conta própria.',
  scope: 'Marca, remarca e cancela visitas e pede a confirmação ao cliente.',
  tools: visitTools,
  briefing: schedulingBriefing,
  routine: {
    queue: 'visit-confirmations',
    cron: (playbook) => {
      const time = confirmations.safeParse(playbook.confirmations).data?.time;
      if (!time) return null;
      const [hour, minute] = time.split(':').map(Number);
      return `${minute} ${hour} * * *`;
    },
    run: async ({ playbook, professional }, createdOn) => {
      const parsed = confirmations.safeParse(playbook.confirmations);
      if (parsed.data?.time == null) return;
      // A run caught up after downtime is created late, so its day is that of the last slot at or before createdOn.
      const today = localDate(createdOn, professional.timezone);
      const slotPassed = toInstant(today, parsed.data.time, professional.timezone) <= createdOn;
      const due = slotPassed ? today : localDate(new Date(createdOn.getTime() - 86_400_000), professional.timezone);
      await requestDueVisitConfirmations(professional, parsed.data.when === 'day_before' ? nextDay(due) : due);
    },
  },
};
