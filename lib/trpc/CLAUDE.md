# tRPC

## Estrutura

- `init.ts` — contexto, procedures base (`baseProcedure`, `protectedProcedure`)
- `query-client.ts` — configuracao do React Query (staleTime: 5min, gcTime: 30min)
- `client.tsx` — provider client-side (`TRPCProvider`, hook `trpc`)
- `server.ts` — utilitarios server-side (`trpc`, `HydrateClient`, `getQueryClient`)
- `routers/_app.ts` — router raiz que agrega todos os sub-routers

## Convencoes

### Criar novo router

1. Criar arquivo em `routers/` (ex: `routers/organizations.ts`)
2. Usar `createTRPCRouter` e `protectedProcedure` (ou `baseProcedure` para rotas publicas)
3. Registrar no `routers/_app.ts`

```tsx
// routers/example.ts
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "@/lib/trpc/init";

export const exampleRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
      // ctx.user e ctx.session garantidos pelo protectedProcedure
      return db.select()...
    }),
});
```

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
