# src/lib

Módulos compartilhados da aplicação: auth, utilitários, server actions, queries e validações.

## Padrões

### Actions

Server actions organizados por domínio em `actions/`. Seguem o padrão:

```ts
export async function createThing(input: CreateThingSchema) {
  noStore()
  try {
    const result = await db
      .insert(things)
      .values({ ... })
      .returning({ id: things.id })
      .then((res) => res[0])

    revalidatePath("/dashboard")

    return { data: result, error: null }
  } catch (err) {
    return { data: null, error: getErrorMessage(err) }
  }
}
```

- Recebem input tipado (não `FormData`)
- Retornam `{ data: T | null, error: string | null }`
- Chamam `noStore()` no início
- Usam `revalidatePath` para invalidar cache
- Usam `getErrorMessage(err)` de `handle-error.ts` para normalizar erros

### Queries

Funções de leitura no banco organizadas por domínio em `queries/`, reutilizáveis em qualquer parte do projeto. Nunca fazer queries inline em pages ou actions.

### Validations

Schemas Zod v4 organizados por domínio em `validations/`, usados nos server actions e formulários. Usar APIs top-level (`z.uuid()`, `z.url()`, `z.email()`) em vez de `z.string().uuid()` etc.

### Geral

- Novos domínios devem seguir a mesma separação: um arquivo por contexto em cada subpasta
