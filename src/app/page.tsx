import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col justify-center items-center">
        <Button asChild>
          <Link href="/login">Entrar</Link>
        </Button>
    </div>
  )
}
