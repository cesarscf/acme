# t/

Rotas públicas dos tenants. O visitante nunca acessa `/t/...` diretamente — o middleware reescreve internamente:

- `tenant.acme.com/` → `/t/tenant`
- `tenant.acme.com/vitoria` → `/t/tenant/vitoria`
- `tenant.acme.com/ofertas/black-friday` → `/t/tenant/ofertas/black-friday`

## Estrutura

- `[slug]/` — Landing page do tenant
- `[slug]/[linkPage]/` — Página de links (por slug da link page, estilo linktree)
- `[slug]/ofertas/[oferta]/` — Página de oferta individual

## Padrões

- Todas as páginas são server components
- Resolução do tenant sempre via `getTenantBySlug()` de `@/lib/queries/tenants`
- Retorna `notFound()` se tenant, link page ou oferta não existir (ou oferta inativa)
