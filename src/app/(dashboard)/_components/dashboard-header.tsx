"use client"

import Link from "next/link"
import { Layers, Settings2Icon, UserIcon, CreditCardIcon, LogOut, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"

export function DashboardHeader() {
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <header className="sticky top-0 z-10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 pb-6 pt-4 md:px-8">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Layers className="size-6" />
        </Link>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-lg">
                <UserIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <UserIcon />
                Conta
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCardIcon />
                Plano
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings2Icon />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                {resolvedTheme === "dark" ? "Tema claro" : "Tema escuro"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  authClient.signOut({
                    fetchOptions: {
                      onSuccess: () => window.location.assign("/login"),
                    },
                  })
                }
              >
                <LogOut />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
