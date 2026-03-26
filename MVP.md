# MVP — Acme

Plataforma multi-tenant para agências de marketing criarem e gerenciarem páginas públicas (ofertas, biolinks) para seus clientes.

## Conceito

A agência se cadastra na plataforma e cria **organizações** (seus clientes). Cada organização possui um subdomínio (`org.acme.com`) e pode ter um **domínio personalizado**. Dentro de cada organização, a agência cria **páginas** a partir de templates pré-definidos, escolhendo o path que quiser (ex: `/promo-verao`, `/links`).

## Usuários

- **Agência:** única conta que gerencia tudo — suas organizações e as páginas de cada uma.
- **Cliente final:** não tem acesso ao painel. Só visualiza as páginas públicas.

## Funcionalidades do MVP

### Auth

- Cadastro e login com email + senha
- Sem OAuth, sem recuperação de senha

### Organizações

- CRUD de organizações
- Cada org tem slug único (usado como subdomínio)
- Possibilidade de adicionar domínio personalizado (via Vercel Domains API)
- Switcher de organização no painel

### Páginas

- CRUD de páginas vinculadas a uma organização
- Path customizado por página (ex: `/ofertas`, `/links`)
- Escolha de template ao criar a página
- Editor simples: cores principais, textos, imagens (formulário estruturado, não drag-and-drop)
- Conteúdo salvo como JSON no banco (cada template define seu schema de dados)
- Suporte a pixel de rastreamento (Facebook, etc.) por página ou por org

### Templates (hardcoded)

Dois templates no MVP, com design fixo e campos editáveis:

1. **Oferta** — página de oferta/promoção com CTA
2. **Biolink** — página estilo Linktree com lista de links

> O design dos templates será definido depois. A estrutura do código deve permitir adicionar novos templates facilmente.

### Páginas Públicas

- Acessíveis via subdomínio (`org.acme.com/path`) ou domínio personalizado (`dominio.com/path`)
- Renderização server-side a partir do JSON salvo no banco
- Detecção de tenant via hostname (subdomínio ou domínio custom)

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (components/blocks)
- **Better Auth** (email + senha)
- **Drizzle ORM** + **Neon Postgres**
- **Vercel** (hosting + Domains API para domínios personalizados)
- **Upload de imagens:** a decidir

## Fora do escopo (MVP)

- Planos e limites de uso
- Permissões e roles (admin, editor)
- Analytics de páginas
- Recuperação de senha
- OAuth / login social
- Editor drag-and-drop
- Templates além de oferta e biolink
