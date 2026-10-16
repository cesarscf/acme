import { customers, db, jobs, professionals, visits } from '@acme/db';
import { and, eq, gt, ne } from 'drizzle-orm';
import { createCustomer } from '../modules/customers/service';
import { upsertPriceItem } from '../modules/quotes/service';
import { createVisit } from '../modules/visits/service';
import { addDays, localDate, toInstant } from '../modules/visits/time';

// Gives a Professional a João Pereira with an open Job and a Visit tomorrow at 14:00, to try the team in his thread:
// "Manda um orçamento de troca do compressor…" and "Remarca para segunda às 10h". Running it again changes nothing.
// Usage: bun run seed:customer-thread <Professional's phone number, e.g. 27997189325>
const typed = process.argv[2]?.replace(/\D/g, '');
if (!typed) throw new Error('Pass the Professional phone number, e.g. 27997189325');
const phoneNumber = typed.startsWith('55') ? typed : `55${typed}`;

const [professional] = await db.select().from(professionals).where(eq(professionals.phoneNumber, phoneNumber));
if (!professional) throw new Error(`No Professional with phone number ${phoneNumber}`);

const { customer: joao } = await createCustomer(professional.id, {
  name: 'João Pereira',
  phoneNumber: `${phoneNumber.slice(0, 4)}99999${phoneNumber.slice(-4)}`,
});
await upsertPriceItem(professional.id, { name: 'Limpeza de split', priceCents: 15000 });

const [coming] = await db
  .select({ id: visits.id, scheduledAt: visits.scheduledAt })
  .from(visits)
  .innerJoin(jobs, eq(jobs.id, visits.jobId))
  .where(
    and(
      eq(visits.customerId, joao.id),
      eq(jobs.status, 'open'),
      ne(visits.status, 'cancelled'),
      gt(visits.scheduledAt, new Date()),
    ),
  );
const visit =
  coming ??
  (await createVisit(
    professional.id,
    joao.id,
    {
      scheduledAt: toInstant(addDays(localDate(new Date(), professional.timezone), 1), '14:00', professional.timezone),
      durationMinutes: 60,
    },
    'Ar da sala não gela',
  ));

const [saved] = await db.select().from(customers).where(eq(customers.id, joao.id));
console.log(
  `${professional.name}: ${saved!.name} (${saved!.phoneNumber}), Visit ${visit.id} at ${visit.scheduledAt.toISOString()}`,
);
process.exit(0);
