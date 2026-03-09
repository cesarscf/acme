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

  if (!landingPage) notFound()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-lg space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          {landingPage.title}
        </h1>
        {landingPage.description && (
          <p className="text-lg text-gray-600">{landingPage.description}</p>
        )}
        {landingPage.url && (
          <a
            href={landingPage.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Saiba mais
          </a>
        )}
      </div>
    </div>
  )
}
