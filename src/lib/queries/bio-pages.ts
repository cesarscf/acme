import { db } from "@/db"
import { bioPages, links } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"

export async function getBioPagesByTenantId(tenantId: string) {
  return db.query.bioPages.findMany({
    where: eq(bioPages.tenantId, tenantId),
    with: { links: { orderBy: [asc(links.position)] } },
    orderBy: [asc(bioPages.createdAt)],
  })
}

export async function getBioPageById(id: string) {
  return db.query.bioPages.findFirst({
    where: eq(bioPages.id, id),
    with: { links: { orderBy: [asc(links.position)] } },
  })
}

export async function getBioPageBySlug(tenantId: string, slug: string) {
  return db.query.bioPages.findFirst({
    where: and(eq(bioPages.tenantId, tenantId), eq(bioPages.slug, slug)),
  })
}

export async function getLinksByPageId(bioPageId: string) {
  return db
    .select()
    .from(links)
    .where(eq(links.bioPageId, bioPageId))
    .orderBy(asc(links.position))
}
