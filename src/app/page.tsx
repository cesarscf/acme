import Link from "next/link"
import { Globe, Layout, Link2, Gift, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

const features = [
  {
    icon: Globe,
    title: "Multi-tenancy",
    description:
      "Cada cliente com seu subdomínio ou domínio próprio, tudo gerenciado em um único painel.",
  },
  {
    icon: Layout,
    title: "Landing pages",
    description:
      "Crie páginas de apresentação para cada cliente com título, descrição e CTA.",
  },
  {
    icon: Link2,
    title: "Páginas de links",
    description:
      "Monte páginas estilo Linktree segmentadas por cidade, loja ou campanha.",
  },
  {
    icon: Gift,
    title: "Páginas de oferta",
    description:
      "Publique ofertas com ativação e desativação independente por cliente.",
  },
]

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="text-lg font-semibold tracking-tight">acme</span>
        <Button asChild size="sm" variant="ghost">
          <Link href="/login">Entrar</Link>
        </Button>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="flex flex-col items-center justify-center gap-6 px-6 py-24 text-center">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Gerencie todos os seus clientes em um só lugar
          </h1>
          <p className="max-w-lg text-lg text-muted-foreground">
            Plataforma para agências criarem landing pages, páginas de links e
            ofertas para cada cliente — cada um com seu próprio domínio.
          </p>
          <Button asChild size="lg">
            <Link href="/login">
              Começar agora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>

        <section className="border-t bg-muted/50 px-6 py-20">
          <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-center gap-4 px-6 py-20 text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Como funciona?
          </h2>
          <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-3">
            <div className="rounded-xl bg-muted p-6">
              <span className="text-2xl font-bold text-primary">1</span>
              <p className="mt-2 text-sm font-medium">Cadastre o cliente</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Defina nome, slug e domínio personalizado
              </p>
            </div>
            <div className="rounded-xl bg-muted p-6">
              <span className="text-2xl font-bold text-primary">2</span>
              <p className="mt-2 text-sm font-medium">Monte as páginas</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Landing page, links e ofertas em minutos
              </p>
            </div>
            <div className="rounded-xl bg-muted p-6">
              <span className="text-2xl font-bold text-primary">3</span>
              <p className="mt-2 text-sm font-medium">Publique</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tudo online no subdomínio ou domínio do cliente
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        acme — plataforma para agências de marketing
      </footer>
    </div>
  )
}
