# App Router

## Estrutura de rotas

- `(auth)/` — rotas publicas de autenticacao (sign-in, sign-up)
- `(app)/` — rotas protegidas (dashboard, futuro)
- `api/auth/[...all]/` — handler do Better Auth
- `api/trpc/[...trpc]/` — handler do tRPC

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
