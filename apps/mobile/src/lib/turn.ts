export type TurnEvent =
  | { type: 'assistant'; assistantId: string }
  | { type: 'status'; text: string }
  | { type: 'text'; text: string }
  | { type: 'message' | 'awaiting_confirmation' | 'done' | 'error' };

// What shows while a turn runs: the reply being written, or else what the Assistant is doing.
export type Turn = { draft: string; status: string | null };

export const idleTurn: Turn = { draft: '', status: null };

export function nextTurn(turn: Turn, event: TurnEvent): Turn {
  switch (event.type) {
    case 'status':
      return { ...turn, status: event.text };
    case 'text':
      return { draft: turn.draft + event.text, status: null };
    case 'assistant':
      return { ...turn, status: null };
    case 'message':
      return idleTurn;
    default:
      return turn;
  }
}
