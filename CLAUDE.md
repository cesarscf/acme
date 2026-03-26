# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
pnpm dev              # Dev server com Turbopack
pnpm build            # Build de produção
pnpm start            # Servir build de produção
pnpm lint             # ESLint (flat config)
pnpm format           # Prettier em todos os .ts/.tsx
pnpm typecheck        # tsc --noEmit
```

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5.9** (strict)
- **Tailwind CSS v4** (via `@tailwindcss/postcss`, sintaxe `@import`/`@theme`)
- **shadcn/ui** (Radix Vega, Lucide icons, CSS variables com OKLCH)
- **next-themes** para dark/light mode (atalho: tecla `D`)
- Gerenciador de pacotes: **pnpm**

## Arquitetura

Aplicação single-repo usando App Router do Next.js. Não é monorepo.

- `app/` — rotas, layouts e páginas (RSC por padrão)
- `components/` — componentes reutilizáveis; `components/ui/` contém os componentes shadcn
- `lib/` — utilitários (`cn()` com clsx + tailwind-merge)
- `hooks/` — hooks customizados

Path alias: `@/*` aponta para a raiz do projeto.

## Convenções

- **Componentes shadcn:** adicionar via CLI (`npx shadcn@latest add <component>`). Config em `components.json`.
- **Estilização:** usar classes Tailwind. Para merge de classes, usar `cn()` de `@/lib/utils`.
- **Variantes de componente:** usar `cva` (class-variance-authority).
- **Variáveis de tema:** definidas em `app/globals.css` usando OKLCH no `@theme`.
- **Prettier:** 80 colunas, 2 espaços, trailing comma ES5, plugin Tailwind habilitado.
- **ESLint:** flat config com presets Next.js core-web-vitals + TypeScript.
- **Commits:** usar conventional commits (`feat:`, `fix:`, `chore:`, etc.).
