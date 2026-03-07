# t/

Rotas públicas dos tenants. O visitante nunca acessa `/t/...` diretamente — o middleware reescreve internamente:

- `tenant.acme.com/` → `/t/tenant`
- `tenant.acme.com/links/vitoria` → `/t/tenant/links/vitoria`
- `tenant.acme.com/ofertas/black-friday` → `/t/tenant/ofertas/black-friday`

## Estrutura

- `[slug]/` — Landing page do tenant
- `[slug]/links/[linksSlug]/` — Página de links (por slug da link page, estilo linktree)
- `[slug]/ofertas/[offerSlug]/` — Página de oferta individual

## Padrões

- Todas as páginas são server components
- Resolução do tenant sempre via `getTenantBySlug()` de `@/lib/queries/tenants`
- Landing page exibe dados da tabela `landing_pages` (com fallback para nome do tenant se não configurada)
- Retorna `notFound()` se tenant, link page ou oferta não existir (ou oferta inativa)
