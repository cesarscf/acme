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

- **Landing pages** — múltiplas por tenant, segmentadas (ex: uma para cada cidade/loja). A LP com slug vazio é a raiz do tenant
- **Bio pages** — múltiplas por tenant, segmentadas (ex: uma para cada cidade/loja), estilo Linktree
- **Offer pages** — múltiplas por tenant, também segmentadas (ex: ofertas específicas por região)

Exemplo: "Farmácia X" tem uma landing page na raiz, outra para Pinheiros (`/pinheiros`), uma bio page para a loja de Vitória, outra para Vila Velha, e offer pages separadas para cada cidade. A agência gerencia tudo via painel admin.

## Features

- **Multi-tenancy** — Subdomínio (tenant.quiwork.com) + custom domain (tenant.com), resolvido via proxy com rewrite para `/t/[slug]/...` (proxy implementado mas middleware ainda não conectado)
- **Auth** — Better Auth (email OTP), apenas agência, sem roles
- **Landing pages** — Múltiplas por tenant. Cada uma com nome (interno), URL do CTA e slug único. Slug vazio = raiz do tenant
- **Bio pages** — Múltiplas por tenant. Cada uma com nome (interno) e lista de links (título + URL), estilo Linktree
- **Offer pages** — Múltiplas por tenant. Cada uma com nome (interno), URL do CTA e slug único
- **Database** — Postgres (Neon) + Drizzle ORM
- **Deploy** — Vercel + Vercel Domains API para custom domains
- **Storage de imagens** — A definir em etapa futura

## Business Rules

### Auth
- Apenas a agência acessa o dashboard (sem roles, sem multi-user por tenant)
- Login via email OTP (4 dígitos)
- OTP apenas logado no console em dev (integração com provedor de email pendente)

### Tenants
- Cada tenant pertence a um usuário (agência)
- Slug é único e obrigatório (apenas letras minúsculas, números e hífens)
- Se subdomínio não for informado, usa o slug como subdomínio
- Custom domain é opcional (campo existe no schema, mas ainda não exposto no form de criação)
- Ao deletar tenant, remove o custom domain da Vercel (se existir) e deleta em cascata (landing pages, bio pages, links, offer pages)

### Multi-tenancy (Proxy) — pendente
- Lógica implementada em `proxy.ts` mas **middleware não conectado** (falta `middleware.ts` na raiz invocando `proxy()`)
- Quando conectado: subdomínio (`tenant.quiwork.com`), custom domain (`tenant.com`), localhost (`tenant.localhost:3000`), Vercel preview (`tenant---project.vercel.app`)
- Rotas `/dashboard` e `/login` serão bloqueadas em domínios de tenant (redireciona para `/`)
- O proxy reescreve internamente para `/t/[slug]/...` — visitante nunca vê `/t/`

### Landing Pages
- Múltiplas por tenant (1:N)
- Slug único por tenant (validado via query antes do insert/update)
- Slug pode ser vazio (`""`) — representa a raiz do tenant (`tenant.quiwork.com/`)
- Não pode haver mais de uma LP com slug vazio por tenant
- Campos: nome (interno, obrigatório), URL do CTA, flag ativa/inativa
- CRUD completo: criar, editar, deletar. Ao criar, redireciona para a página de detalhes
- LPs inativas retornam 404 na página pública
- Se não existe LP com slug vazio, a raiz do tenant retorna 404
- Rota pública: `tenant.quiwork.com/` (raiz) e `tenant.quiwork.com/[slug]` (demais)

### Bio Pages
- Múltiplas por tenant (1:N)
- Slug único por tenant (validado via try-catch no insert, sem constraint composta no schema)
- Cada página contém lista de links (título + URL) ordenados por posição
- Links são deletados em cascata ao remover a página
- Campos: nome (interno, obrigatório), flag ativa/inativa
- Rota pública: `tenant.quiwork.com/bios/[slug]`

### Offer Pages
- Múltiplas por tenant (1:N)
- Slug único por tenant (validado via try-catch no insert, sem constraint composta no schema)
- Campos: nome (interno, obrigatório), URL do CTA, flag ativa/inativa
- Offer pages inativas retornam 404 na página pública
- Rota pública: `tenant.quiwork.com/ofertas/[slug]`

### Custom Domains
- Configurado na página de settings do tenant (`/dashboard/tenants/[id]/settings`)
- Ao salvar, chama `addDomainToVercel()` para registrar na Vercel
- Ao remover ou trocar, chama `removeDomainFromVercel()` para o domínio anterior
- `deleteTenantAction()` também chama `removeDomainFromVercel()` se houver custom domain
- Verificação DNS via API route `/api/domain-check` que consulta Vercel API
- Status e instruções DNS exibidos na página de settings abaixo do form

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
