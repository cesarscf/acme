# Monorepo com API Elysia separada, sem API routes do Expo

O MVP é um monorepo Turborepo com Bun workspaces: `apps/api` (Elysia + Drizzle + Postgres) e `apps/mobile` (Expo, só iOS e Android). Toda a lógica de servidor (IA, Rotinas, dados) fica na API Elysia; as API routes do Expo Router não são usadas, e o app consome a API por Eden Treaty com tipos compartilhados. Assim o backend roda, escala e é implantado sem depender do app, e o tipo da API é a única fronteira entre os dois.

## Consequences

- O app não tem build web; `web.output` fica no padrão e não existem arquivos `+api.ts`.
- Enquanto a correção do Bun para isolated installs não sair, o monorepo usa `linker = "hoisted"` (ver `docs/research/mvp-stack.md`).
