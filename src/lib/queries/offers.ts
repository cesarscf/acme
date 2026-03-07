import { db } from "@/db"
import { offers } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"

export async function getOffersByTenantId(tenantId: string) {
  return db
    .select()
    .from(offers)
    .where(eq(offers.tenantId, tenantId))
    .orderBy(asc(offers.createdAt))
}

export async function getOfferBySlug(tenantId: string, slug: string) {
  return db.query.offers.findFirst({
    where: and(eq(offers.tenantId, tenantId), eq(offers.slug, slug)),
  })
}
