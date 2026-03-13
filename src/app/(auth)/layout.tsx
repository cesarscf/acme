import { auth } from "@/lib/auth"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {

    const session = await auth.api.getSession({
      headers: await headers(),
    })
  
    if (session) {
      redirect("/dashboard")
    }
  

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      {children}
    </div>
  )
}
