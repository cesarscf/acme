import { db } from "@/db"
import { linkPages, links } from "@/db/schema"
import { asc, eq } from "drizzle-orm"

export async function getLinkPagesByTenantId(tenantId: string) {
  return db.query.linkPages.findMany({
    where: eq(linkPages.tenantId, tenantId),
    with: { links: { orderBy: [asc(links.position)] } },
    orderBy: [asc(linkPages.createdAt)],
  })
}
