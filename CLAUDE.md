# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — Start dev server (Next.js with Turbopack)
- `pnpm build` — Production build
- `pnpm lint` — Run ESLint
- `pnpm format` — Format with Prettier
- `pnpm typecheck` — TypeScript type checking

## Architecture

Next.js 16 app with React 19, using the App Router and `src/` directory layout. UI components come from shadcn/ui (radix-nova style). Styling is done with Tailwind CSS v4 and CSS variables for theming. Dark mode is handled via next-themes with class strategy.

## Commits

- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `style:`, `test:`, etc.
- Never include `Co-Authored-By` lines.

## Documentation

- Create `CLAUDE.md` files inside feature/module folders to document context, rules, and decisions specific to that scope.
- Each folder-level `CLAUDE.md` should only cover what lives in that folder — avoid referencing external contexts.
- Avoid documenting specific folder/file names — focus on patterns and conventions, since names may change over time.

## Workflow

- When implementing something new, ask the user if there's any ambiguity — never guess how it should work.

## Key Conventions

- **File naming:** Always use kebab-case (e.g., `mode-toggle.tsx`, not `ModeToggle.tsx`).
- **Code clarity:** Avoid comments — prefer descriptive variable and function names that make the code self-explanatory.

- **shadcn/ui** — Add components via `npx shadcn@latest add <name>`.
- **Path alias:** `@/*` maps to `src/*`
- **Styling:** Use `cn()` from `@/lib/utils` for conditional Tailwind classes.
- **Formatting:** Prettier — no semicolons, double quotes, 2-space indent, trailing commas (es5). Tailwind plugin sorts classes automatically.
- **Icons:** lucide-react
