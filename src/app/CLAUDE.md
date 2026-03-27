# App Router

## Estrutura de rotas

- `(auth)/` — rotas públicas de autenticação (sign-in, sign-up)
- `(onboarding)/` — fluxo de onboarding pós-cadastro (criar primeira org)
- `(app)/` — rotas protegidas com sidebar (requer autenticação + org ativa)
  - `pages/` — CRUD de páginas (lista, criar, editar)
  - `pages/new/` — formulário de criação de página
  - `pages/[id]/edit/` — formulário de edição de página (conteúdo por template)
  - `settings/` — configurações da org (subdomínio e custom domain)
- `t/[domain]/[[...path]]/` — página pública do tenant com catch-all route (domain pode ser slug da org ou custom domain, resolve pelo banco)
- `api/auth/[...all]/` — handler do Better Auth
- `api/trpc/[...trpc]/` — handler do tRPC

## Multi-tenancy (subdomains + custom domains)

O `proxy.ts` (Next.js 16) resolve tenants em 3 etapas:
1. Tenta extrair subdomain do host (ex: `loja.localhost:3000`) → rewrite para `/t/{slug}`
2. Se é o domínio raiz, segue normalmente (rotas da plataforma)
3. Se não é subdomain nem domínio raiz (custom domain), rewrite para `/t/{hostname}` — a page resolve por `customDomain` no banco

Rewrites:
- `loja.localhost:3000/` → `/t/loja`
- `loja.localhost:3000/products` → `/t/loja/products`
- `meudominio.com/` → `/t/meudominio.com` (resolve por `customDomain` no banco)
- Rotas `/api`, `/_next` e `/favicon` passam direto pelo proxy
- A env `NEXT_PUBLIC_ROOT_DOMAIN` define o domínio raiz (default: `localhost:3000`)

### Custom domains

- `organizations.setCustomDomain` — mutation tRPC para configurar custom domain
- `organizations.removeCustomDomain` — mutation tRPC para remover custom domain

## Fluxo de autenticação

1. Usuário faz sign-up/sign-in em `(auth)/`
2. `(app)/layout.tsx` lista orgs via `auth.api.listOrganizations`
3. Se não tem nenhuma org, redireciona para `/onboarding`
4. Se tem org mas nenhuma ativa, auto-ativa a primeira via `auth.api.setActiveOrganization`
5. Renderiza sidebar com org switcher

## Convenções

- **Pages são sempre Server Components** — nunca usar `"use client"` em `page.tsx` ou `layout.tsx`
- **Prefetch no servidor** — usar `trpc.*.prefetch()` + `HydrateClient` para hidratar dados no cliente
- **Client components** — extrair para arquivos separados (ex: `sign-in-form.tsx`) e importar na page
- **Providers** — `providers.tsx` wrapa TRPCProvider + QueryClientProvider, usado no root layout

## Padrão de Server Component com prefetch

```tsx
import { HydrateClient, trpc } from "@/lib/trpc/server";

export default async function Page() {
  await connection();
  void trpc.example.list.prefetch();

  return (
    <HydrateClient>
      <ClientComponent />
    </HydrateClient>
  );
}
```

## Padrão de formulário

- Definir schema Zod no próprio arquivo do form
- Usar `zodResolver` com React Hook Form
- Erros do servidor via `setError("root", { message })`
- Exibir primeiro erro encontrado (root > campo1 > campo2)
