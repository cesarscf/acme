# src/db

Camada de banco de dados usando Drizzle ORM com Neon Postgres (driver HTTP serverless).

## Padrões

- Tabelas: plural, snake_case (ex: `users`, `sessions`, `pages`)
- IDs: `text` para tabelas do Better Auth, `uuid` para tabelas da aplicação
- Timestamps: `created_at` e `updated_at` em todas as tabelas, com `$onUpdate` para atualizar automaticamente
- Todas as tabelas da aplicação usam `onDelete: "cascade"` nas foreign keys
- Relations do Drizzle definidas no mesmo arquivo da tabela principal
- Schemas organizados por domínio dentro da pasta `schemas/`, com barrel export via `index.ts`
- O `schema.ts` na raiz re-exporta tudo para compatibilidade com drizzle-kit
- A instância `db` é exportada com `schema` para habilitar `db.query.*` (relational queries)
