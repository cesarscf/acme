import { notFound } from "next/navigation"

import { getTenantBySlug } from "@/lib/queries/tenants"
import { getLandingPageBySlug } from "@/lib/queries/landing-pages"

export default async function TenantLandingPage({
  params,
}: {
  params: Promise<{ slug: string; lpSlug: string }>
}) {
  const { slug, lpSlug } = await params

  const tenant = await getTenantBySlug(slug)

  if (!tenant) notFound()

  const landingPage = await getLandingPageBySlug(tenant.id, lpSlug)

  if (!landingPage || !landingPage.active) notFound()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <p className="text-muted-foreground">
        Landing Page: {landingPage.name} (vamos alterar no futuro)
      </p>
    </div>
  )
}
