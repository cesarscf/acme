"use client"

import { useSyncExternalStore } from "react"
import { LogOut, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"

const emptySubscribe = () => () => {}

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

export function SidebarUserCard({ email }: { email: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()

  return (
    <Card> 
      <CardContent>
        <div className="mb-3 grid gap-0.5">
          <p className="text-muted-foreground text-xs">Conectado como</p>
          <p className="truncate text-sm font-medium">
            {email}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => authClient.signOut()}
          >
            <LogOut />
            Sair
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {mounted && resolvedTheme === "dark" ? <Moon /> : <Sun />}
            {mounted && resolvedTheme === "dark" ? "Escuro" : "Claro"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
