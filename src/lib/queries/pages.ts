import { db } from "@/db"
import { pages } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"

export async function getPagesByOrganizationId(organizationId: string) {
  return db.query.pages.findMany({
    where: eq(pages.organizationId, organizationId),
    orderBy: [asc(pages.createdAt)],
  })
}

export async function getPageById(id: string) {
  return db.query.pages.findFirst({
    where: eq(pages.id, id),
  })
}

export async function getPageByPath(organizationId: string, path: string) {
  return db.query.pages.findFirst({
    where: and(eq(pages.organizationId, organizationId), eq(pages.path, path)),
  })
}
