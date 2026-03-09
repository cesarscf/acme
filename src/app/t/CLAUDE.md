# t/

Rotas públicas dos tenants. O visitante não deve acessar `/t/...` diretamente — quando o middleware for conectado, o proxy reescreverá internamente:

- `tenant.acme.com/` → `/t/tenant`
- `tenant.acme.com/pinheiros` → `/t/tenant/pinheiros`
- `tenant.acme.com/links/vitoria` → `/t/tenant/links/vitoria`
- `tenant.acme.com/ofertas/black-friday` → `/t/tenant/ofertas/black-friday`

**Nota:** O middleware ainda não está conectado (lógica existe em `proxy.ts` mas falta `middleware.ts` na raiz).

## Estrutura

- `[slug]/` — Landing page raiz do tenant (slug vazio no banco)
- `[slug]/[lpSlug]/` — Landing page por slug
- `[slug]/links/[linksSlug]/` — Página de links (por slug da link page, estilo linktree)
- `[slug]/ofertas/[offerSlug]/` — Página de oferta individual

## Padrões

- Todas as páginas são server components
- Resolução do tenant sempre via `getTenantBySlug()` de `@/lib/queries/tenants`
- Landing pages são 1:N por tenant, cada uma com slug único (slug vazio = raiz `/`)
- Retorna `notFound()` se tenant, landing page, link page ou oferta não existir (ou oferta inativa)
