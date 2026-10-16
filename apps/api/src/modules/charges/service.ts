import { assistants, charges, customers, db, workRecords } from '@acme/db';
import { and, desc, eq, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { formatMoney } from '../briefing/scripts';
import { addNotice } from '../conversations/notices';
import type { ConfirmationCard } from '../conversations/tools';
import { concludeJob } from '../jobs/service';
import { pixBrCode } from '../pix/br-code';
import { defineTemplate, ensureTemplate, onButtonClick, sendMessage } from '../whatsapp/service';
import { pixCity, pixKey, pixName } from './briefing';

type Professional = { id: string; name: string; timezone: string };
export type ChargeWithCustomer = NonNullable<Awaited<ReturnType<typeof findCharge>>>;

// The spec's default for the reminder Routine: a day after the Pix went out, at most twice.
const reminderAfterDays = 1;
const reminderLimit = 2;

const paidButton = { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Já paguei' }] } as const;

const examplePixCode =
  '00020126430014br.gov.bcb.pix0121carlos@exemplo.com.br5204000053039865406320.005802BR5915Carlos Eletrica6009Sao Paulo62070503***63046F76';

const chargeTemplate = defineTemplate({
  name: 'pix_charge',
  language: 'pt_BR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: 'Olá, {{1}}! Segue o Pix de {{2}} pelo serviço {{3}}, no valor de {{4}}.\n\nCopie o código abaixo e cole no app do seu banco, em Pix copia e cola:\n{{5}}\n\nDepois de pagar, toque em Já paguei.',
      example: { body_text: [['Ana', 'Carlos Elétrica', 'Instalação de chuveiro', 'R$ 320,00', examplePixCode]] },
    },
    paidButton,
  ],
});

const chargeReminderTemplate = defineTemplate({
  name: 'pix_charge_reminder',
  language: 'pt_BR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: 'Olá, {{1}}! Passando para lembrar do Pix de {{2}}, no valor de {{3}}.\n\nO código para Pix copia e cola é:\n{{4}}\n\nSe já pagou, toque em Já paguei.',
      example: { body_text: [['Ana', 'Carlos Elétrica', 'R$ 320,00', examplePixCode]] },
    },
    paidButton,
  ],
});

const buttonActions = ['paid'] as const;

export async function ensureChargeTemplates() {
  await ensureTemplate(env('META_PLATFORM_WABA_ID'), chargeTemplate);
  await ensureTemplate(env('META_PLATFORM_WABA_ID'), chargeReminderTemplate);
}

export async function findPixAccount(professionalId: string) {
  const [billingAssistant] = await db
    .select({ playbook: assistants.playbook })
    .from(assistants)
    .where(and(eq(assistants.professionalId, professionalId), eq(assistants.role, 'billing')));
  const playbook = (billingAssistant?.playbook ?? {}) as Record<string, unknown>;
  const key = pixKey.safeParse(playbook.pixKey);
  const name = pixName.safeParse(playbook.pixName);
  const city = pixCity.safeParse(playbook.pixCity);
  if (!key.success || !name.success || !city.success) return null;
  return { key: key.data.key, name: name.data, city: city.data };
}

// The Pix txid is at most 25 letters and digits.
export function chargePixCode(
  { id, amountCents }: { id: string; amountCents: number },
  account: { key: string; name: string; city: string },
) {
  return pixBrCode({ ...account, amountCents, txid: id.replaceAll('-', '').slice(0, 25) });
}

export async function findCharge(professionalId: string, id: string) {
  const [charge] = await db
    .select({
      id: charges.id,
      workRecordId: charges.workRecordId,
      jobId: workRecords.jobId,
      status: charges.status,
      amountCents: charges.amountCents,
      paymentMethod: charges.paymentMethod,
      sentAt: charges.sentAt,
      remindedCount: charges.remindedCount,
      paidAt: charges.paidAt,
      service: sql<string>`coalesce(${workRecords.description}, ${workRecords.title}, 'Serviço')`,
      customer: { id: customers.id, name: customers.name, phoneNumber: customers.phoneNumber },
    })
    .from(charges)
    .innerJoin(customers, eq(customers.id, charges.customerId))
    .innerJoin(workRecords, eq(workRecords.id, charges.workRecordId))
    .where(and(eq(charges.id, id), eq(charges.professionalId, professionalId)));
  return charge;
}

// A WorkRecord is charged by Pix once.
export function findPixCharge(workRecordId: string) {
  return db.query.charges.findFirst({
    where: and(eq(charges.workRecordId, workRecordId), eq(charges.paymentMethod, 'pix')),
  });
}

// A corrected amount reaches the Pix Charge until it is paid; its Pix code is made from the amount when sent.
export async function followAmount(workRecordId: string, amountCents: number) {
  await db
    .update(charges)
    .set({ amountCents })
    .where(
      and(
        eq(charges.workRecordId, workRecordId),
        eq(charges.paymentMethod, 'pix'),
        inArray(charges.status, ['pending', 'awaiting_confirmation']),
      ),
    );
}

export async function createCharge(professionalId: string, workRecordId: string) {
  const workRecord = await db.query.workRecords.findFirst({
    where: and(eq(workRecords.id, workRecordId), eq(workRecords.professionalId, professionalId)),
  });
  if (!workRecord) return { refused: 'work_record_not_found' as const };
  const { customerId, amountCents } = workRecord;
  if (!customerId || !amountCents) return { refused: 'work_record_incomplete' as const };
  const paid = await db.query.charges.findFirst({
    where: and(eq(charges.workRecordId, workRecordId), eq(charges.status, 'paid')),
  });
  if (paid) return { refused: 'already_paid' as const };
  await db
    .insert(charges)
    .values({ professionalId, workRecordId, customerId, amountCents, paymentMethod: 'pix' })
    .onConflictDoNothing({ target: [charges.workRecordId, charges.paymentMethod] });
  const pixCharge = (await findPixCharge(workRecordId))!;
  return { charge: (await findCharge(professionalId, pixCharge.id))! };
}

// Sending again (a new link after "Não caiu", say) starts the reminders over.
export async function sendCharge(
  charge: ChargeWithCustomer,
  professional: Professional,
  account: { key: string; name: string; city: string },
) {
  // ADR 0003: the Customer channel is the Professional's own number, connected in ticket 18; M1 sends from the platform's.
  await sendTemplate(chargeTemplate.name, charge, [
    charge.customer.name,
    professional.name,
    charge.service,
    formatMoney(charge.amountCents),
    chargePixCode(charge, account),
  ]);
  await db
    .update(charges)
    .set({ status: 'pending', sentAt: new Date(), remindedCount: 0, remindedAt: null })
    .where(eq(charges.id, charge.id));
}

// "Recebi" marks the Charge paid, even before the Customer taps "Já paguei"; "Não caiu" puts it back to pending.
export async function confirmChargePaid(professionalId: string, id: string, received: boolean) {
  const charge = await findCharge(professionalId, id);
  if (!charge) return { refused: 'not_found' as const };
  // A cancelled Pix belongs to a WorkRecord the Customer paid another way.
  if (charge.status === 'paid' || charge.status === 'cancelled') return { refused: 'already_paid' as const };
  await db
    .update(charges)
    .set(received ? { status: 'paid', paidAt: new Date() } : { status: 'pending' })
    .where(eq(charges.id, id));
  if (received && charge.jobId) await concludeJob(charge.jobId);
  return { charge: (await findCharge(professionalId, id))! };
}

// The confirmation card for a Pix Charge, as in the prototype; the conversation and the service thread show the same one.
export function chargeCard({
  customerName,
  service,
  amountCents,
}: {
  customerName: string;
  service: string;
  amountCents: number;
}): ConfirmationCard {
  const first = customerName.split(' ')[0]!;
  return {
    title: 'Para confirmar: cobrar no Pix',
    subtitle: customerName,
    rows: [
      { label: 'Cliente', value: customerName },
      { label: 'Serviço', value: service },
      { label: 'Valor', value: formatMoney(amountCents) },
      { label: 'Forma', value: 'Pix (link e QR Code)' },
      { label: 'Envio', value: `WhatsApp do ${first}` },
    ],
    notices: [
      `Nada é enviado ao ${first} agora.`,
      'Depois que você confirmar, ele recebe o link do Pix no WhatsApp e eu aviso quando o dinheiro cair.',
    ],
    question: `Confirma: cobrar ${formatWholeMoney(amountCents)} do ${first}?`,
  };
}

// "R$ 350" as the prototype says it; cents only when there are any.
export function formatWholeMoney(cents: number) {
  return cents % 100 === 0 ? formatMoney(cents).replace(/,00$/, '') : formatMoney(cents);
}

export async function listUnpaidWorkRecords(professionalId: string) {
  const rows = await db
    .select({
      workRecordId: workRecords.id,
      createdAt: workRecords.createdAt,
      service: sql<string>`coalesce(${workRecords.description}, ${workRecords.title}, 'Serviço')`,
      amountCents: workRecords.amountCents,
      customer: { id: customers.id, name: customers.name },
    })
    .from(workRecords)
    .innerJoin(customers, eq(customers.id, workRecords.customerId))
    .where(
      and(
        eq(workRecords.professionalId, professionalId),
        isNotNull(workRecords.amountCents),
        sql`not exists (select 1 from ${charges} where ${charges.workRecordId} = ${workRecords.id} and ${charges.status} = 'paid')`,
      ),
    )
    .orderBy(desc(workRecords.createdAt))
    .limit(50);
  const pixCharges = rows.length
    ? await db
        .select({ id: charges.id, workRecordId: charges.workRecordId, status: charges.status, sentAt: charges.sentAt })
        .from(charges)
        .where(
          and(
            inArray(
              charges.workRecordId,
              rows.map(({ workRecordId }) => workRecordId),
            ),
            eq(charges.paymentMethod, 'pix'),
          ),
        )
    : [];
  return rows.map((row) => ({
    ...row,
    charge: pixCharges.find(({ workRecordId }) => workRecordId === row.workRecordId) ?? null,
  }));
}

export async function remindDueCharges(professional: Professional, now: Date) {
  const account = await findPixAccount(professional.id);
  if (!account) return;
  const cutoff = new Date(now.getTime() - reminderAfterDays * 86_400_000);
  const due = await db
    .select({ id: charges.id, remindedCount: charges.remindedCount, remindedAt: charges.remindedAt })
    .from(charges)
    .where(
      and(
        eq(charges.professionalId, professional.id),
        eq(charges.status, 'pending'),
        lt(charges.remindedCount, reminderLimit),
        lte(charges.sentAt, cutoff),
        or(isNull(charges.remindedAt), lte(charges.remindedAt, cutoff)),
      ),
    );
  for (const { id, remindedCount, remindedAt } of due) {
    // Claimed before sending, so a retry overlapping the next run cannot remind the same Customer twice.
    const [claimed] = await db
      .update(charges)
      .set({ remindedCount: remindedCount + 1, remindedAt: now })
      .where(and(eq(charges.id, id), eq(charges.remindedCount, remindedCount), eq(charges.status, 'pending')))
      .returning({ id: charges.id });
    if (!claimed) continue;
    const charge = (await findCharge(professional.id, id))!;
    try {
      await sendTemplate(chargeReminderTemplate.name, charge, [
        charge.customer.name,
        professional.name,
        formatMoney(charge.amountCents),
        chargePixCode(charge, account),
      ]);
    } catch (error) {
      await db.update(charges).set({ remindedCount, remindedAt }).where(eq(charges.id, id));
      throw error;
    }
    const text = `Rotina: lembrei ${charge.customer.name} do Pix de ${formatMoney(charge.amountCents)}.`;
    await db.transaction((tx) => addNotice(tx, professional.id, 'billing', text, { customerId: charge.customer.id }));
  }
}

async function sendTemplate(name: string, charge: ChargeWithCustomer, body: string[]) {
  await sendMessage({
    from: env('META_PLATFORM_PHONE_NUMBER_ID'),
    to: charge.customer.phoneNumber,
    message: {
      type: 'template',
      template: {
        name,
        language: { code: 'pt_BR' },
        components: [
          { type: 'body', parameters: body.map((text) => ({ type: 'text' as const, text })) },
          ...buttonActions.map((action, index) => ({
            type: 'button' as const,
            sub_type: 'quick_reply' as const,
            index: String(index),
            parameters: [{ type: 'payload' as const, payload: action }],
          })),
        ],
      },
    },
    origin: { type: 'charge', id: charge.id },
  });
}

onButtonClick('charge', async ({ originId, button, tx }) => {
  const [charge] = await tx
    .select({
      id: charges.id,
      status: charges.status,
      amountCents: charges.amountCents,
      professionalId: charges.professionalId,
      customerName: customers.name,
    })
    .from(charges)
    .innerJoin(customers, eq(customers.id, charges.customerId))
    .where(eq(charges.id, originId))
    .for('update', { of: charges });
  if (!charge || !buttonActions.some((action) => action === button.payload)) return;
  const amount = formatMoney(charge.amountCents);
  // A second tap while the Professional has not answered yet asks nothing new.
  if (charge.status === 'awaiting_confirmation') return;
  let text: string;
  if (charge.status === 'paid' || charge.status === 'cancelled') {
    text = `${charge.customerName} tocou em ${button.text} no Pix de ${amount}, mas ele já estava pago. Nada mudou.`;
  } else {
    await tx.update(charges).set({ status: 'awaiting_confirmation' }).where(eq(charges.id, charge.id));
    text = `${charge.customerName} tocou em ${button.text} no Pix de ${amount}. Confira no app do banco: Recebi ou Não caiu?`;
  }
  await addNotice(tx, charge.professionalId, 'billing', text);
});

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
