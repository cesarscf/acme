import { db } from "@/db"
import { landingPages } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function getLandingPageByTenantId(tenantId: string) {
  return db.query.landingPages.findFirst({
    where: eq(landingPages.tenantId, tenantId),
  })
}
