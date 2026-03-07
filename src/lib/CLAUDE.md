# src/lib

Módulos compartilhados da aplicação: auth, utilitários, server actions, queries e validações.

## Estrutura

- `auth.ts` — Configuração server-side do Better Auth (email OTP, Drizzle adapter, nextCookies)
- `auth-client.ts` — Cliente Better Auth para uso em componentes React
- `utils.ts` — `cn()` para classes Tailwind, `rootDomain` e `protocol` para URLs multi-tenant
- `vercel.ts` — Integração com Vercel Domains API (adicionar/remover domínios custom)
- `actions/` — Server actions organizados por domínio (tenants, link-pages, links, offers, auth)
- `queries/` — Funções de leitura no banco organizadas por domínio, reutilizáveis em qualquer parte do projeto
- `validations/` — Schemas Zod organizados por domínio, usados nos server actions e formulários

## Padrões

- Server actions usam `useActionState` no client e recebem `(_prevState, formData)` como assinatura
- Validação sempre via schemas Zod importados de `validations/`
- Leitura de dados sempre via funções de `queries/`, nunca queries inline nos actions ou pages
- Novos domínios devem seguir a mesma separação: um arquivo por contexto em cada subpasta
