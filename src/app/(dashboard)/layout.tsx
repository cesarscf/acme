import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { DashboardHeader } from "./_components/dashboard-header"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/60 font-semibold">
      <DashboardHeader />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
