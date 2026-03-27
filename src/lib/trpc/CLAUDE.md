# tRPC

## Estrutura

- `init.ts` — contexto, procedures base (`baseProcedure`, `protectedProcedure`)
- `query-client.ts` — configuração do React Query (staleTime: 5min, gcTime: 30min)
- `client.tsx` — provider client-side (`TRPCProvider`, hook `trpc`)
- `server.ts` — utilitários server-side (`trpc`, `HydrateClient`, `getQueryClient`)
- `routers/_app.ts` — router raiz que agrega todos os sub-routers
- `routers/organizations.ts` — CRUD de organizations (bySlug, list, active, create, update, setCustomDomain, removeCustomDomain, domainStatus, verifyDomain)
- `routers/pages.ts` — CRUD de pages (list, byId, byDomainAndPath, create, update, delete)

## Convenções

### Criar novo router

1. Criar arquivo em `routers/` (ex: `routers/example.ts`)
2. Usar `createTRPCRouter` e `protectedProcedure` (ou `baseProcedure` para rotas públicas)
3. Registrar no `routers/_app.ts`

```tsx
// routers/example.ts
import { z } from "zod";
import { db } from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "@/lib/trpc/init";

export const exampleRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
      // ctx.user, ctx.session e ctx.organizationId garantidos pelo protectedProcedure
      return db.select()...
    }),
});
```

### Contexto do protectedProcedure

O `protectedProcedure` garante que `ctx` contém:
- `session` — sessão ativa
- `user` — usuário autenticado
- `organizationId` — ID da org ativa (via Better Auth organization plugin)

### Usar no cliente

```tsx
"use client";
import { trpc } from "@/lib/trpc/client";

export function MyComponent() {
  const { data, isLoading } = trpc.example.list.useQuery();
  // ...
}
```

### Invalidar queries

```tsx
const utils = trpc.useUtils();
await utils.example.list.invalidate();
```
