import { notFound } from "next/navigation"

import { getTenantBySlug } from "@/lib/queries/tenants"

export default async function TenantLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tenant = await getTenantBySlug(slug)

  if (!tenant) notFound()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          {tenant.name}
        </h1>
        <p className="mt-3 text-lg text-gray-600">Landing page</p>
      </div>
    </div>
  )
}
