# App Router

## Estrutura de rotas

- `(auth)/` — rotas publicas de autenticacao (sign-in, sign-up)
- `(onboarding)/` — fluxo de onboarding pos-cadastro (criar primeira org)
- `(app)/` — rotas protegidas com sidebar (requer autenticacao + org ativa)
- `t/[slug]/` — storefront da loja (acessada via subdomain rewrite, nao diretamente)
- `api/auth/[...all]/` — handler do Better Auth
- `api/trpc/[...trpc]/` — handler do tRPC

## Multi-tenancy (subdomains)

O `proxy.ts` (Next.js 16) detecta subdomains e faz rewrite para `/t/[slug]`:
- `loja.localhost:3000/` → `/t/loja`
- `loja.localhost:3000/products` → `/t/loja/products`
- Rotas da plataforma (`/sign-in`, `/sign-up`, `/onboarding`, `/api`) sao bloqueadas via subdomain
- A env `NEXT_PUBLIC_ROOT_DOMAIN` define o dominio raiz (default: `localhost:3000`)

## Fluxo de autenticacao

1. Usuario faz sign-up/sign-in em `(auth)/`
2. `(app)/layout.tsx` lista orgs via `auth.api.listOrganizations`
3. Se nao tem nenhuma org, redireciona para `/onboarding`
4. Se tem org mas nenhuma ativa, auto-ativa a primeira via `auth.api.setActiveOrganization`
5. Renderiza sidebar com org switcher

## Convencoes

- **Pages sao sempre Server Components** — nunca usar `"use client"` em `page.tsx` ou `layout.tsx`
- **Prefetch no servidor** — usar `trpc.*.prefetch()` + `HydrateClient` para hidratar dados no cliente
- **Client components** — extrair para arquivos separados (ex: `sign-in-form.tsx`) e importar na page
- **Providers** — `providers.tsx` wrapa TRPCProvider + QueryClientProvider, usado no root layout

## Padrao de Server Component com prefetch

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

## Padrao de formulario

- Definir schema Zod no proprio arquivo do form
- Usar `zodResolver` com React Hook Form
- Erros do servidor via `setError("root", { message })`
- Exibir primeiro erro encontrado (root > campo1 > campo2)
