# Database (Drizzle ORM)

## Estrutura

- `index.ts` — cliente do banco (singleton em dev, pool max 10)
- `schema/` — definicoes de tabelas, uma por arquivo
- `schema/index.ts` — barrel export de todas as tabelas + objeto `schema`

## Convencoes

- **Casing** — usar `casing: "snake_case"` no Drizzle (campos camelCase no TS, snake_case no banco)
- **IDs** — `text().primaryKey()` (gerado pelo Better Auth)
- **Timestamps** — sempre incluir `createdAt` e `updatedAt` com `defaultNow()`
- **Foreign keys** — definir com `references()` e `onDelete: "cascade"` quando apropriado
- **Nova tabela** — criar arquivo em `schema/`, exportar no `schema/index.ts` e adicionar ao objeto `schema`

## Comandos

```bash
pnpm db:generate  # gerar migrations
pnpm db:migrate   # rodar migrations
pnpm db:push      # push direto (dev)
pnpm db:studio    # abrir Drizzle Studio
```
