import { db } from "@/db"
import { tenants } from "@/db/schema"
import { desc, eq } from "drizzle-orm"

export async function getTenants() {
  return db.select().from(tenants).orderBy(desc(tenants.createdAt))
}

export async function getTenantById(id: string) {
  return db.query.tenants.findFirst({
    where: eq(tenants.id, id),
  })
}

export async function getTenantBySlug(slug: string) {
  return db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  })
}
