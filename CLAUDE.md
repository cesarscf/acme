# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — Start dev server (Next.js with Turbopack)
- `pnpm build` — Production build
- `pnpm lint` — Run ESLint
- `pnpm format` — Format with Prettier
- `pnpm typecheck` — TypeScript type checking

## Project

Plataforma multi-tenant para agência de marketing. A agência cadastra clientes (tenants), cada um com seu domínio ou subdomínio. Cada tenant possui:

- **Landing page** — página principal do tenant
- **Páginas de links** — múltiplas por tenant, segmentadas (ex: uma para cada cidade/loja)
- **Páginas de oferta** — múltiplas por tenant, também segmentadas (ex: ofertas específicas por região)

Exemplo: "Farmácia X" tem uma landing page, uma página de links para a loja de Vitória, outra para Vila Velha, e páginas de oferta separadas para cada cidade. A agência gerencia tudo via painel admin.

## Features

- **Multi-tenancy** — Subdomínio (tenant.quiwork.com) + custom domain (tenant.com), resolvido via proxy com rewrite para `/t/[slug]/...` (proxy implementado mas middleware ainda não conectado)
- **Auth** — Better Auth (email OTP + Google OAuth), apenas agência, sem roles
- **Landing page** — Campos fixos por tenant: título, descrição e CTA (link)
- **Páginas de links** — Múltiplas por tenant. Cada uma com título, descrição e lista de links (título + URL), estilo Linktree
- **Páginas de oferta** — Múltiplas por tenant. Cada uma com título, descrição e CTA (link)
- **Database** — Postgres (Neon) + Drizzle ORM
- **Deploy** — Vercel + Vercel Domains API para custom domains
- **Storage de imagens** — A definir em etapa futura

## Business Rules

### Auth
- Apenas a agência acessa o dashboard (sem roles, sem multi-user por tenant)
- Login via email OTP (4 dígitos) ou Google OAuth
- OTP apenas logado no console em dev (integração com provedor de email pendente)

### Tenants
- Cada tenant pertence a um usuário (agência)
- Slug é único e obrigatório (apenas letras minúsculas, números e hífens)
- Se subdomínio não for informado, usa o slug como subdomínio
- Custom domain é opcional (campo existe no schema, mas ainda não exposto no form de criação)
- Ao deletar tenant, remove o custom domain da Vercel (se existir) e deleta em cascata (landing page, link pages, links, ofertas)

### Multi-tenancy (Proxy) — pendente
- Lógica implementada em `proxy.ts` mas **middleware não conectado** (falta `middleware.ts` na raiz invocando `proxy()`)
- Quando conectado: subdomínio (`tenant.quiwork.com`), custom domain (`tenant.com`), localhost (`tenant.localhost:3000`), Vercel preview (`tenant---project.vercel.app`)
- Rotas `/dashboard` e `/login` serão bloqueadas em domínios de tenant (redireciona para `/`)
- O proxy reescreve internamente para `/t/[slug]/...` — visitante nunca vê `/t/`

### Landing Page
- Uma por tenant (relação 1:1 via tabela `landing_pages`)
- Todos os campos são opcionais (título, descrição, URL do CTA)
- Upsert: enviar todos vazios deleta a landing page existente
- Se não existe landing page, a página pública exibe o nome do tenant como fallback

### Páginas de Links
- Múltiplas por tenant (1:N)
- Slug único por tenant (validado via try-catch no insert, sem constraint composta no schema)
- Cada página contém lista de links (título + URL) ordenados por posição
- Links são deletados em cascata ao remover a página
- Rota pública: `tenant.quiwork.com/links/[slug]`

### Ofertas
- Múltiplas por tenant (1:N)
- Slug único por tenant (validado via try-catch no insert, sem constraint composta no schema)
- Campos: título, descrição, URL do CTA, flag ativa/inativa
- Ofertas inativas retornam 404 na página pública
- Rota pública: `tenant.quiwork.com/ofertas/[slug]`

### Custom Domains — parcialmente implementado
- Funções `addDomainToVercel()` e `removeDomainFromVercel()` existem em `vercel.ts`
- `deleteTenantAction()` já chama `removeDomainFromVercel()` se o tenant tiver custom domain
- Criação de tenant com custom domain ainda não implementada (form não tem o campo, action não chama `addDomainToVercel()`)
- Verificação DNS via API route `/api/domain-check` que consulta Vercel API
- Status exibido no dashboard do tenant

## Architecture

Next.js 16 app with React 19, using the App Router and `src/` directory layout. UI components come from shadcn/ui (radix-nova style). Styling is done with Tailwind CSS v4 and CSS variables for theming. Dark mode is handled via next-themes with class strategy.

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
- **Actions:** Server actions ficam em `src/lib/actions/`, separados por contexto.
