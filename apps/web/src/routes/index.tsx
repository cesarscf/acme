import { createFileRoute } from "@tanstack/react-router"
import { ModeToggle } from "@/components/mode-toggle"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <div>
      <ModeToggle />
    </div>
  )
}
