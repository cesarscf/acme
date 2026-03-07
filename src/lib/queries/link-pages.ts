import { db } from "@/db"
import { linkPages, links } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"

export async function getLinkPagesByTenantId(tenantId: string) {
  return db.query.linkPages.findMany({
    where: eq(linkPages.tenantId, tenantId),
    with: { links: { orderBy: [asc(links.position)] } },
    orderBy: [asc(linkPages.createdAt)],
  })
}

export async function getLinkPageBySlug(tenantId: string, slug: string) {
  return db.query.linkPages.findFirst({
    where: and(eq(linkPages.tenantId, tenantId), eq(linkPages.slug, slug)),
  })
}

export async function getLinksByPageId(linkPageId: string) {
  return db
    .select()
    .from(links)
    .where(eq(links.linkPageId, linkPageId))
    .orderBy(asc(links.position))
}
