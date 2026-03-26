# Database (Drizzle ORM)

## Estrutura

- `index.ts` — cliente do banco (singleton em dev, pool max 10)
- `schema/index.ts` — todas as tabelas, relations e objeto `schema` em um unico arquivo

## Schema

Gerado pelo CLI do Better Auth (`pnpm dlx @better-auth/cli generate`). Nao editar manualmente as tabelas de auth.

### Tabelas

- `users` — usuarios da plataforma
- `sessions` — sessoes ativas (inclui `activeOrganizationId`)
- `accounts` — contas vinculadas (email/password)
- `verifications` — tokens de verificacao
- `organizations` — organizacoes (clientes da agencia), com `customDomain`
- `members` — membros de organizacoes (userId + organizationId + role)
- `invitations` — convites para organizacoes

### Convencoes

- **Nomes de coluna explicitos** — usar `text("column_name")` (sem `casing` automatico)
- **IDs** — `text("id").primaryKey()` (gerado pelo Better Auth)
- **Timestamps** — `$onUpdate(() => new Date())` para `updatedAt`
- **Indexes** — definidos no terceiro argumento do `pgTable`
- **Relations** — definidas com `relations()` do Drizzle para queries relacionais

## Comandos

```bash
pnpm dlx @better-auth/cli generate  # gerar schema do Better Auth
pnpm db:push                        # push direto (dev)
pnpm db:generate                    # gerar migrations
pnpm db:migrate                     # rodar migrations
pnpm db:studio                      # abrir Drizzle Studio
```
