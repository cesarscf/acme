import { db, jobs, visits } from '@acme/db';
import { and, eq, gt, ne, sql } from 'drizzle-orm';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// A Customer has at most one open Job: a new request goes into it, or opens one titled after the request.
export async function openJob(
  professionalId: string,
  customerId: string,
  title: string,
  tx: Transaction | typeof db = db,
) {
  const [opened] = await tx
    .insert(jobs)
    .values({ professionalId, customerId, title })
    .onConflictDoNothing({ target: jobs.customerId, where: sql`${jobs.status} = 'open'` })
    .returning({ id: jobs.id });
  if (opened) return opened.id;
  const [open] = await tx
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.customerId, customerId), eq(jobs.status, 'open')));
  return open!.id;
}

// A paid Charge (or cash received) concludes the Job.
export async function concludeJob(jobId: string, tx: Transaction | typeof db = db) {
  await tx
    .update(jobs)
    .set({ status: 'done', closedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'open')));
}

// A declined Quote ends the Job, unless a Visit is still coming.
export async function declineJob(jobId: string, tx: Transaction) {
  const [coming] = await tx
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.jobId, jobId), ne(visits.status, 'cancelled'), gt(visits.scheduledAt, new Date())))
    .limit(1);
  if (coming) return;
  await tx
    .update(jobs)
    .set({ status: 'declined', closedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'open')));
}
