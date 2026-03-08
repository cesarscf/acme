# t/

Rotas públicas dos tenants. O visitante não deve acessar `/t/...` diretamente — quando o middleware for conectado, o proxy reescreverá internamente:

- `tenant.acme.com/` → `/t/tenant`
- `tenant.acme.com/links/vitoria` → `/t/tenant/links/vitoria`
- `tenant.acme.com/ofertas/black-friday` → `/t/tenant/ofertas/black-friday`

**Nota:** O middleware ainda não está conectado (lógica existe em `proxy.ts` mas falta `middleware.ts` na raiz).

## Estrutura

- `[slug]/` — Landing page do tenant
- `[slug]/links/[linksSlug]/` — Página de links (por slug da link page, estilo linktree)
- `[slug]/ofertas/[offerSlug]/` — Página de oferta individual

## Padrões

- Todas as páginas são server components
- Resolução do tenant sempre via `getTenantBySlug()` de `@/lib/queries/tenants`
- Landing page exibe dados da tabela `landing_pages` (com fallback para nome do tenant se não configurada)
- Retorna `notFound()` se tenant, link page ou oferta não existir (ou oferta inativa)
