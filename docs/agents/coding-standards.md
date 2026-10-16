# Coding standards

## Naming

- **Files and folders: kebab-case.** `send-quote.ts`, `price-items/`, `apps/meta-emulator/`. Expo Router files keep the router's syntax (`_layout.tsx`, `[id].tsx`, `(tabs)/`) with kebab-case inside it (`work-records/[id].tsx`).
- **Identifiers: TypeScript casing.** camelCase for values and functions, PascalCase for types and components.
- **Database: plural tables, snake_case.** Tables are plural (`work_records`, `price_items`, `assistants`), columns snake_case. Drizzle runs with `casing: 'snake_case'`, so the TypeScript side stays camelCase (`workRecords`, `scheduledAt`).
- **Domain words come from `CONTEXT.md`**, in English: `Quote`, `Charge`, `WorkRecord`, `Customer`. Use the canonical term in every name; the `_Avoid_` words stay out of code.

## Language

Code is English: identifiers, tables, columns, enum values (`status: 'awaiting_confirmation'`), tool and parameter names, routes, events. pt-BR goes only in text the AI reads or the user sees: system prompts, tool `description`s, WhatsApp templates and UI copy, written inline (no i18n library).

## Comments

Names carry the meaning. A comment earns its place only when it records a _why_ the code cannot show: a Meta payload quirk, a workaround (with the issue link), a constraint from outside the code. Keep it to one line.

## Direct code

Write the direct version first: plain functions, plain modules, Drizzle called straight from the service. Add a layer (repository, base class, factory, DI container, generic wrapper) only when a second real caller needs it today. Three similar lines beat a premature helper.

Organise by feature, not by technical layer:

```
apps/api/src/modules/<feature>/
  index.ts     # Elysia instance (controller)
  service.ts   # logic
  model.ts     # t schemas
```

## Framework practice

Follow each tool's official guidance; `docs/research/mvp-stack.md` summarises it with sources. The points that shape code most:

- **Elysia** ([best practice](https://elysiajs.com/essential/best-practice)): one Elysia instance per controller; handlers destructure what they need and call the service; schemas with `t`, registered via `.model()`; `throw status(...)`; `resolve` over `derive`; chain every method and `export type App` so Eden keeps its types; the app imports it with `import type` only.
- **Expo**: file-based routes with Expo Router; native packages added with `bun expo install` so versions match the SDK; Tailwind and animations as in ADR 0002.
- **Drizzle**: schema lives in `packages/db`; migrations come from `drizzle-kit generate` and are committed.
- **SDKs** (Anthropic, Better Auth): use the SDK's own helpers and types instead of re-implementing them.

When this file and a tool's docs disagree, this file wins.

## Styling

Both UIs use Tailwind v4 with the **shadcn token names** (`background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, plus their `-foreground` pairs), filled with the colours of the product design (`prototype/index.html`). The prototype's own colours that shadcn has no name for (the status pills `warning`, `info`, `orange`, `purple`, `pink`, `teal`, and `whatsapp`, `mention`, `highlight`) are tokens too, in the same file. Components use only these tokens (`bg-primary`, `text-muted-foreground`), never raw colours.

- **`apps/meta-emulator`**: shadcn/ui components, added with the `shadcn` CLI.
- **`apps/mobile`**: Uniwind (ADR 0002) with the same token names.
- The token values live in one shared CSS file that both apps import. If Uniwind cannot read shadcn's format, each app keeps its own file with identical names and values.

## Dependencies

Add every package at its latest stable version (`npm view <pkg> version`), pinned exactly. Platforms override this:

- **Expo SDK** decides React, React Native and every native package: install them with `bun expo install`.
- **Uniwind** decides Tailwind: `tailwindcss` matches the `@tailwindcss/node` version Uniwind depends on.
- The monorepo keeps **one version of each shared package** (React, Tailwind, Elysia), because the hoisted linker would otherwise load two copies; web apps follow the version mobile is forced to use.
