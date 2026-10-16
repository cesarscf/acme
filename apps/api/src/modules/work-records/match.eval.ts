import { describe, expect, test } from 'bun:test';
import { customerOf, scriptedTeam } from '../conversations/scripted-conversation';
import { addDays, localDate, toInstant } from '../time/time';
import { createVisit } from '../visits/service';
import { matchVisit } from './match';

// Real model, real tokens: run with `bun run evals`, never in `bun run test`.
const timeZone = 'America/Sao_Paulo';
const today = (time: string) => toInstant(localDate(new Date(), timeZone), time, timeZone);

async function dayWithJoaoAndMarta() {
  const team = await scriptedTeam();
  const professionalId = team.professional.id;
  const joao = await customerOf(team, 'João Pereira');
  const marta = await customerOf(team, 'Marta Lima');
  const ana = await customerOf(team, 'Ana Souza');
  const joaos = await createVisit(
    professionalId,
    joao.id,
    { scheduledAt: today('08:00'), durationMinutes: 60 },
    'Ar da sala não gela',
  );
  const martas = await createVisit(
    professionalId,
    marta.id,
    { scheduledAt: today('14:00'), durationMinutes: 60 },
    'Limpeza de split',
  );
  const anas = await createVisit(
    professionalId,
    ana.id,
    { scheduledAt: toInstant(addDays(localDate(new Date(), timeZone), 1), '09:00', timeZone), durationMinutes: 60 },
    'Instalação de split',
  );
  return { professionalId, joaos, martas, anas };
}

describe('which Visit an account is about', () => {
  test('"fui no João, o compressor queimou" is about João\'s Visit today, even before it ends', async () => {
    const { professionalId, joaos } = await dayWithJoaoAndMarta();

    const matched = await matchVisit(
      professionalId,
      null,
      'Fui no João, o compressor do split da sala queimou. Precisa trocar, manda orçamento.',
    );

    expect(matched?.suggested?.visitId).toBe(joaos.id);
  });

  test('the service said, without the name, finds the Visit by what it is', async () => {
    const { professionalId, martas } = await dayWithJoaoAndMarta();

    const matched = await matchVisit(professionalId, null, 'Terminei a limpeza do split, 350 no Pix.');

    expect(matched?.suggested?.visitId).toBe(martas.id);
  });

  test('a Customer who has no Visit to tell suggests none', async () => {
    const { professionalId } = await dayWithJoaoAndMarta();

    const matched = await matchVisit(
      professionalId,
      null,
      'Instalei um chuveiro na casa da dona Cida, 200 em dinheiro.',
    );

    expect(matched?.suggested).toBeNull();
  });
});
