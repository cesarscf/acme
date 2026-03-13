# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — Start dev server (Next.js with Turbopack)
- `pnpm build` — Production build
- `pnpm lint` — Run ESLint
- `pnpm format` — Format with Prettier
- `pnpm typecheck` — TypeScript type checking

## Project

Plataforma multi-tenant para agência de marketing. A agência cadastra organizações (via Better Auth organization plugin), cada uma com seu domínio ou subdomínio. Cada organização possui múltiplas **páginas** — criadas a partir de templates — cada uma com um path customizado escolhido pela agência.

Exemplo: "Farmácia X" tem uma página de links na raiz, outra em `/pinheiros`, uma página de ofertas em `/ofertas/verao`, etc. A agência gerencia tudo via painel admin.

## Features

- **Multi-tenancy** — Cada organização = um tenant. Subdomínio (org.quiwork.com) + custom domain (org.com), resolvido via `src/proxy.ts` com rewrite para `/t/[slug]/...`
- **Auth** — Better Auth (email OTP + organization plugin), apenas agência
- **Organizations** — Better Auth organization plugin como sistema de tenants. Campos customizados: `customDomain` e `domainVerified` via `additionalFields`. Criação de org adiciona o usuário como owner automaticamente.
- **Pages** — Múltiplas por organização. Cada página criada a partir de um template (hardcoded), com path customizado e conteúdo em JSON
- **Database** — Postgres (Neon) + Drizzle ORM
- **Deploy** — Vercel + Vercel Domains API para custom domains
- **Storage de imagens** — A definir em etapa futura

## Architecture

Next.js 16 app with React 19, using the App Router and `src/` directory layout. UI components come from shadcn/ui (radix-nova style). Styling is done with Tailwind CSS v4 and CSS variables for theming. Dark mode is handled via next-themes with class strategy.

### Pages System

Templates são hardcoded no código. Cada template define um layout e quais campos de conteúdo são editáveis. Páginas são instâncias de um template, armazenadas no banco com path customizado e `content` em JSON.

**Schema da tabela `pages`:**

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid | primary key |
| `organizationId` | text | FK → organizations (cascade) |
| `name` | text | label interno, não exibido publicamente |
| `path` | text | path customizado, único por organização. Vazio = raiz |
| `templateSlug` | text | referencia um template hardcoded (ex: `links-1`) |
| `content` | jsonb | campos editáveis do template |
| `active` | boolean | páginas inativas retornam 404 |

Templates exportam: `slug`, `label`, `contentSchema` (Zod) e `Component` (React).

### Multi-tenancy & Proxy

Next.js 16 renomeou `middleware.ts` para `proxy.ts`. O arquivo `src/proxy.ts` exporta uma função `proxy` e um `config`, reconhecido automaticamente pelo Next.js.

**Rewrite flow:**
```
lojax.acme.com/meus-links/pinheiros
  → proxy detecta subdomínio "lojax"
  → reescreve para /t/lojax/meus-links/pinheiros

lojax.com/meus-links/pinheiros  (custom domain)
  → proxy detecta custom domain "lojax.com"
  → reescreve para /t/lojax.com/meus-links/pinheiros
```

O proxy passa `_tenantType` (`"subdomain"` | `"customDomain"`) como query param para a rota interna resolver o tenant corretamente.

**Host patterns suportados:**

| Pattern | Exemplo | Detectado como |
|---|---|---|
| Subdomínio | `lojax.acme.com` | subdomain `lojax` |
| Custom domain | `lojax.com` | custom domain `lojax.com` |
| Localhost | `lojax.localhost:3000` | subdomain `lojax` |
| Vercel preview | `lojax---project.vercel.app` | subdomain `lojax` |

Rotas `/dashboard` e `/login` em domínios de tenant são redirecionadas para `/`.

### Routing Summary

```
Public:
  tenant.acme.com/                    → page with path ""
  tenant.acme.com/qualquer/path       → page with path "qualquer/path"
  tenant.com/qualquer/path            → same, via custom domain

Internal (never visible to visitors):
  /t/[tenantSlug]/[[...path]]         → optional catch-all handler (path="" for root, path="a/b" for others)

Dashboard:
  /dashboard/tenants/[id]             → tenant detail + pages list
  /dashboard/tenants/[id]/pages/[id]  → edit page
  /dashboard/tenants/[id]/settings    → settings (custom domain, etc.)
```

## Business Rules

### Auth
- Apenas a agência acessa o dashboard (sem roles, sem multi-user por tenant)
- Login via email OTP (4 dígitos)
- OTP apenas logado no console em dev (integração com provedor de email pendente)

### Organizations
- Cada organização é gerenciada pelo Better Auth organization plugin
- O criador da org é automaticamente adicionado como `owner` (BA gerencia membership)
- Slug é único e obrigatório (apenas letras minúsculas, números e hífens)
- Custom domain é opcional (campo customizado via `additionalFields`, não gerenciado pelo BA)
- Ao deletar org, remove o custom domain da Vercel (se existir) e BA faz cascade de members/invitations. Pages deletadas via FK cascade no banco.

### Pages
- Múltiplas por organização (1:N)
- `path` único por organização (ex: `meus-links/pinheiros`)
- `path` vazio (`""`) representa a raiz da organização — no máximo um por org
- `templateSlug` referencia um template hardcoded no código
- Conteúdo editável em JSON no campo `content`
- Páginas inativas retornam 404 na rota pública

### Custom Domains
- Configurado na página de settings da organização
- Ao salvar, chama `addDomainToVercel()` para registrar na Vercel
- Ao remover ou trocar, chama `removeDomainFromVercel()` para o domínio anterior
- `deleteOrganization()` também chama `removeDomainFromVercel()` se houver custom domain
- Verificação DNS via API route `/api/domain-check` que consulta Vercel API
- Status e instruções DNS exibidos na página de settings abaixo do form

## Commits

- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `style:`, `test:`, etc.
- Never include `Co-Authored-By` lines.
- Before committing, check if any `CLAUDE.md` (root or folder-level) needs to be created or updated to reflect the changes.

## Documentation

- Create `CLAUDE.md` files inside feature/module folders to document context, rules, and decisions specific to that scope.
- Each folder-level `CLAUDE.md` should only cover what lives in that folder — avoid referencing external contexts.
- Avoid documenting specific folder/file names — focus on patterns and conventions, since names may change over time.

## Workflow

- When implementing something new, ask the user if there's any ambiguity — never guess how it should work.
- Before implementing, check if there's a CLI/skill available for the feature/lib/tech (e.g., `npx shadcn`, `npx @better-auth/cli`, `npx drizzle-kit`).
- When adding a new feature/module, ask the user where it should live before creating files.

## Key Conventions

- **File naming:** Always use kebab-case (e.g., `mode-toggle.tsx`, not `ModeToggle.tsx`).
- **Code clarity:** Avoid comments — prefer descriptive variable and function names that make the code self-explanatory.
- **Component placement:** Components specific to a single page/route go in `_components/` inside that route folder. Shared components used across multiple routes go in `src/components/`.
- **shadcn/ui** — Add components via `npx shadcn@latest add <name>`.
- **Path alias:** `@/*` maps to `src/*`
- **Styling:** Use `cn()` from `@/lib/utils` for conditional Tailwind classes.
- **Formatting:** Prettier — no semicolons, double quotes, 2-space indent, trailing commas (es5). Tailwind plugin sorts classes automatically.
- **Icons:** lucide-react
- **Env** — t3-env para validação e tipagem de variáveis de ambiente
- **Queries:** Funções de leitura no banco ficam em `src/lib/queries/`, separadas por contexto. Nunca fazer queries inline em pages ou actions.
- **Validations:** Schemas Zod ficam em `src/lib/validations/`, separados por contexto. Actions importam daqui.
- **Actions:** Server actions ficam em `src/lib/actions/`, separados por contexto. Seguem o padrão abaixo:

```ts
export async function createThing(input: CreateThingSchema & { userId: string }) {
  noStore()
  try {
    const result = await db
      .insert(things)
      .values({ ... })
      .returning({ id: things.id })
      .then((res) => res[0])

    revalidatePath("/dashboard")

    return { data: result, error: null }
  } catch (err) {
    return { data: null, error: getErrorMessage(err) }
  }
}
```

  - Recebem input tipado (não `FormData`)
  - Retornam `{ data: T | null, error: string | null }`
  - Chamam `noStore()` no início
  - Usam `revalidatePath` para invalidar cache
  - Usam `getErrorMessage(err)` de `@/lib/handle-error` para normalizar erros
