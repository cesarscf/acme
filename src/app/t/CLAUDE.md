# t/

Rotas públicas dos tenants. O visitante não deve acessar `/t/...` diretamente — quando o middleware for conectado, o proxy reescreverá internamente:

- `tenant.acme.com/` → `/t/tenant`
- `tenant.acme.com/pinheiros` → `/t/tenant/pinheiros`
- `tenant.acme.com/bios/vitoria` → `/t/tenant/bios/vitoria`
- `tenant.acme.com/ofertas/black-friday` → `/t/tenant/ofertas/black-friday`

**Nota:** O middleware ainda não está conectado (lógica existe em `proxy.ts` mas falta `middleware.ts` na raiz).

## Estrutura

- `[slug]/` — Landing page raiz do tenant (slug vazio no banco)
- `[slug]/[lpSlug]/` — Landing page por slug
- `[slug]/bios/[bioSlug]/` — Bio page (por slug, estilo linktree)
- `[slug]/ofertas/[offerSlug]/` — Offer page individual

## Padrões

- Todas as páginas são server components
- Resolução do tenant sempre via `getTenantBySlug()` de `@/lib/queries/tenants`
- Landing pages são 1:N por tenant, cada uma com slug único (slug vazio = raiz `/`)
- Retorna `notFound()` se tenant, landing page, bio page ou offer page não existir (ou página inativa)
