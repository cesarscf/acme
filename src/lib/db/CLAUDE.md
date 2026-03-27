# Database (Drizzle ORM)

## Estrutura

- `index.ts` — cliente do banco (singleton em dev, pool max 10)
- `schema/index.ts` — todas as tabelas, relations e objeto `schema` em um único arquivo

## Schema

Gerado pelo CLI do Better Auth (`pnpm dlx @better-auth/cli generate`). Não editar manualmente as tabelas de auth.

### Tabelas

- `users` — usuários da plataforma
- `sessions` — sessões ativas (inclui `activeOrganizationId`)
- `accounts` — contas vinculadas (email/password)
- `verifications` — tokens de verificação
- `organizations` — organizações (clientes da agência), com `customDomain`
- `members` — membros de organizações (userId + organizationId + role)
- `invitations` — convites para organizações
- `pages` — páginas públicas (organizationId + path + template + content JSON)

### Convenções

- **Nomes de coluna explícitos** — usar `text("column_name")` (sem `casing` automático)
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
