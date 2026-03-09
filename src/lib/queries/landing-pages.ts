import { db } from "@/db"
import { landingPages } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"

export async function getLandingPagesByTenantId(tenantId: string) {
  return db.query.landingPages.findMany({
    where: eq(landingPages.tenantId, tenantId),
    orderBy: [asc(landingPages.createdAt)],
  })
}

export async function getLandingPageById(id: string) {
  return db.query.landingPages.findFirst({
    where: eq(landingPages.id, id),
  })
}

export async function getLandingPageBySlug(tenantId: string, slug: string) {
  return db.query.landingPages.findFirst({
    where: and(
      eq(landingPages.tenantId, tenantId),
      eq(landingPages.slug, slug)
    ),
  })
}
