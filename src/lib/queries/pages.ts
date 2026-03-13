import { db } from "@/db"
import { pages } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"

export async function getPagesByTenantId(tenantId: string) {
  return db.query.pages.findMany({
    where: eq(pages.tenantId, tenantId),
    orderBy: [asc(pages.createdAt)],
  })
}

export async function getPageById(id: string) {
  return db.query.pages.findFirst({
    where: eq(pages.id, id),
  })
}

export async function getPageByPath(tenantId: string, path: string) {
  return db.query.pages.findFirst({
    where: and(eq(pages.tenantId, tenantId), eq(pages.path, path)),
  })
}
