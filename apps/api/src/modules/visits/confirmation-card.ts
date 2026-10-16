import type { ConfirmationCard } from '../conversations/tools';

type Entry = { visitId: string; name: string; when: string };

// The card shown before asking several Customers at once; the ids are the Visits it lists, so what is sent is what was shown.
export function confirmationsCard(entries: Entry[], title: string) {
  const count = entries.length === 1 ? '1 cliente' : `${entries.length} clientes`;
  const card: ConfirmationCard = {
    title,
    subtitle: count,
    rows: entries.map(({ name, when }) => ({ label: when, value: name })),
    notices: [
      'Nada é enviado agora.',
      'Depois que você confirmar, cada cliente recebe uma mensagem no WhatsApp com os botões Confirmar e Remarcar.',
    ],
    question: `Confirma: pedir a confirmação de ${count}?`,
  };
  return { visitIds: entries.map(({ visitId }) => visitId), card };
}
