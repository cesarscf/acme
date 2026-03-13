import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <Button asChild>
        <Link href="/login">Entrar</Link>
      </Button>
    </div>
  )
}
