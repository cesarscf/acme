# Project Rules

## Stack

Next.js 16 (App Router, Turbopack), Tailwind CSS v4, Biome (lint/format), pnpm, TypeScript, better-auth, Drizzle ORM, postgres-js, React Hook Form, Zod v4

## Naming

- **Booleans** — always prefix with `is`, `has`, `should`, `can`, `was`, `will` (e.g. `isLoading`, `isPasswordVisible`, `hasError`)
- **Named exports only** — use `export const` / `export type`, no default exports (exception: Next.js page/layout files which require `export default`)
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`

## Forms

- **React Hook Form + Zod** for all forms — define a Zod schema, infer the TS type, use `zodResolver`
- **Zod v4 syntax** — use `z.email()` not `z.string().email()` (top-level validators)
- Server errors go to `setError("root", { message })`, displayed separately from field errors

## Multi-tenancy

- `proxy.ts` na raiz do projeto (Next.js 16 usa `proxy` ao invés de `middleware`) — detecta subdomain e faz rewrite para `/t/[slug]`
- O slug da organization é o subdomain da loja
- Env `NEXT_PUBLIC_ROOT_DOMAIN` define o domínio raiz (default: `localhost:3000`)

## Documentação por pasta

- Cada pasta do projeto deve ter seu próprio `CLAUDE.md` com a documentação específica daquela pasta (responsabilidades, estrutura, convenções locais)
- Isso evita misturar contextos e mantém a documentação próxima do código relevante
- Ao criar ou modificar uma pasta significativa, crie/atualize o `CLAUDE.md` correspondente

## Git

- Sempre fazer commit e push sem incluir `Co-Authored-By` nas mensagens de commit
- Usar conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`
