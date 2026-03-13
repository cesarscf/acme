# t/

Rotas públicas das organizações (tenants). O visitante não acessa `/t/...` diretamente — o proxy reescreve internamente:

- `org.acme.com/` → `/t/org`
- `org.acme.com/meus-links/pinheiros` → `/t/org/meus-links/pinheiros`

## Estrutura

Um único arquivo `[slug]/[[...path]]/page.tsx` (catch-all opcional) cobre todos os paths:

- `path` ausente → resolve como `""` (raiz da organização)
- `path` presente → join com `/` (ex: `["meus-links", "pinheiros"]` → `"meus-links/pinheiros"`)

## Padrões

- Server component — resolve organização, busca page por path, renderiza pelo `templateSlug`
- Retorna `notFound()` se organização não existir, page não existir ou page estiver inativa
- Resolução por `slug` (subdomínio) ou `customDomain` via `_tenantType` query param passado pelo proxy
