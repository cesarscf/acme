import { db, runningTurns } from '@acme/db';
import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import type { Assistant } from './service';

// A running turn renews its row, so the row of an API process that died expires and frees the Assistant and the thread.
const holdMs = 60_000;
export const renewMs = 20_000;

function holdUntil() {
  return new Date(Date.now() + holdMs);
}

async function isHeld(column: typeof runningTurns.assistantId | typeof runningTurns.customerId, id: string) {
  const [row] = await db
    .select({ id: runningTurns.id })
    .from(runningTurns)
    .where(and(eq(column, id), gt(runningTurns.expiresAt, new Date())));
  return !!row;
}

export function isWorking(assistantId: string) {
  return isHeld(runningTurns.assistantId, assistantId);
}

export function isCustomerWorking(customerId: string) {
  return isHeld(runningTurns.customerId, customerId);
}

function freeExpired(column: typeof runningTurns.assistantId | typeof runningTurns.customerId, id: string) {
  return db.delete(runningTurns).where(and(eq(column, id), lte(runningTurns.expiresAt, new Date())));
}

// Held from a message's arrival until its turn starts: picking who answers takes a Claude call, and a second message must wait.
export async function claimCustomerThread(customerId: string) {
  await freeExpired(runningTurns.customerId, customerId);
  const [claimed] = await db
    .insert(runningTurns)
    .values({ customerId, expiresAt: holdUntil() })
    .onConflictDoNothing()
    .returning({ id: runningTurns.id });
  return claimed?.id;
}

// Frees a claim whose turn never started; a started turn frees its row when it ends.
export async function releaseClaim(claimId: string) {
  await db.delete(runningTurns).where(and(eq(runningTurns.id, claimId), isNull(runningTurns.assistantId)));
}

// In a Customer's thread the turn takes over its claim; in the Assistant's chat it holds a row of its own.
export async function holdTurn(assistantId: Assistant['id'], claimId?: string) {
  await freeExpired(runningTurns.assistantId, assistantId);
  if (!claimId) {
    const [held] = await db
      .insert(runningTurns)
      .values({ assistantId, expiresAt: holdUntil() })
      .onConflictDoNothing()
      .returning({ id: runningTurns.id });
    return held?.id;
  }
  try {
    const [held] = await db
      .update(runningTurns)
      .set({ assistantId, expiresAt: holdUntil() })
      .where(and(eq(runningTurns.id, claimId), isNull(runningTurns.assistantId)))
      .returning({ id: runningTurns.id });
    return held?.id;
  } catch (error) {
    if (isUniqueViolation(error)) return undefined;
    throw error;
  }
}

export function renewTurn(id: string) {
  return db.update(runningTurns).set({ expiresAt: holdUntil() }).where(eq(runningTurns.id, id));
}

export function freeTurn(id: string) {
  return db.delete(runningTurns).where(eq(runningTurns.id, id));
}

function isUniqueViolation(error: unknown) {
  const cause = error instanceof Error && error.cause ? error.cause : error;
  return (cause as { code?: string } | null)?.code === '23505';
}
