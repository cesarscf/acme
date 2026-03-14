"use client"

import * as React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavUser } from "./nav-user"
import { OrganizationSwitcher } from "./organization-switcher"
import { User } from "@/lib/auth"
import { Organization } from "better-auth/plugins"

export function AppSidebar({
  organizations,
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  organizations: Organization[]
  user: User
}) {
  
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <OrganizationSwitcher organizations={organizations} />
      </SidebarHeader>
      <SidebarContent />
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
