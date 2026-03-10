import { db } from "@/db"
import { offerPages } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"

export async function getOfferPagesByTenantId(tenantId: string) {
  return db
    .select()
    .from(offerPages)
    .where(eq(offerPages.tenantId, tenantId))
    .orderBy(asc(offerPages.createdAt))
}

export async function getOfferPageById(id: string) {
  return db.query.offerPages.findFirst({
    where: eq(offerPages.id, id),
  })
}

export async function getOfferPageBySlug(tenantId: string, slug: string) {
  return db.query.offerPages.findFirst({
    where: and(eq(offerPages.tenantId, tenantId), eq(offerPages.slug, slug)),
  })
}
