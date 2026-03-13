# t/

Rotas públicas dos tenants. O visitante não acessa `/t/...` diretamente — o proxy reescreve internamente:

- `tenant.acme.com/` → `/t/tenant`
- `tenant.acme.com/meus-links/pinheiros` → `/t/tenant/meus-links/pinheiros`

## Estrutura

Um único arquivo `[slug]/[[...path]]/page.tsx` (catch-all opcional) cobre todos os paths:

- `path` ausente → resolve como `""` (raiz do tenant)
- `path` presente → join com `/` (ex: `["meus-links", "pinheiros"]` → `"meus-links/pinheiros"`)

## Padrões

- Server component — resolve tenant, busca page por path, renderiza pelo `templateSlug`
- Retorna `notFound()` se tenant não existir, page não existir ou page estiver inativa
- Tenant resolvido por `slug` (subdomínio) — resolução por custom domain a ser implementada via `_tenantType` query param do proxy
