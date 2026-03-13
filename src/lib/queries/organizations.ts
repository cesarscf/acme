import { db } from "@/db"
import { organizations } from "@/db/schema"
import { desc, eq } from "drizzle-orm"

export async function getOrganizations() {
  return db.select().from(organizations).orderBy(desc(organizations.createdAt))
}

export async function getOrganizationById(id: string) {
  return db.query.organizations.findFirst({
    where: eq(organizations.id, id),
  })
}

export async function getOrganizationBySlug(slug: string) {
  return db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
  })
}

export async function getOrganizationByCustomDomain(domain: string) {
  return db.query.organizations.findFirst({
    where: eq(organizations.customDomain, domain),
  })
}
