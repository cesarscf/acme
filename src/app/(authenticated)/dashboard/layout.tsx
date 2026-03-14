import { auth } from "@/lib/auth"
import { getOrganizations } from "@/lib/queries/organizations"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "./_components/app-siderbar"

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

  const organizations = await getOrganizations()

  if (!organizations.length) {
    redirect("/onboarding")
  }

  return (
    <SidebarProvider>
      <AppSidebar organizations={organizations} user={session.user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
        </header>

        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
