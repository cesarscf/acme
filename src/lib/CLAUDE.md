# src/lib

Módulos compartilhados da aplicação: auth, utilitários, server actions, queries e validações.

## Estrutura

- `auth.ts` — Configuração server-side do Better Auth (email OTP, Drizzle adapter, nextCookies)
- `auth-client.ts` — Cliente Better Auth para uso em componentes React
- `types.ts` — Tipos compartilhados (`FormState<T>` usado nos server actions)
- `utils.ts` — `cn()` para classes Tailwind, `rootDomain` e `protocol` para URLs multi-tenant
- `handle-error.ts` — `getErrorMessage(err)` normaliza erros para string; `showErrorToast(err)` exibe via sonner
- `vercel.ts` — Integração com Vercel Domains API (adicionar/remover domínios custom)
- `actions/` — Server actions organizados por domínio (tenants, pages, auth)
- `queries/` — Funções de leitura no banco organizadas por domínio (tenants, pages), reutilizáveis em qualquer parte do projeto
- `validations/` — Schemas Zod v4 organizados por domínio, usados nos server actions e formulários. Usar APIs top-level (`z.uuid()`, `z.url()`, `z.email()`) em vez de `z.string().uuid()` etc.

## Padrões

- Actions recebem input tipado (não `FormData`), retornam `{ data: T | null, error: string | null }`
- Chamar `noStore()` no início de toda action
- Erros normalizados via `getErrorMessage(err)` de `handle-error.ts`
- Invalidação de cache via `revalidatePath`
- Validação sempre via schemas Zod importados de `validations/`
- Leitura de dados sempre via funções de `queries/`, nunca queries inline nos actions ou pages
- Novos domínios devem seguir a mesma separação: um arquivo por contexto em cada subpasta
