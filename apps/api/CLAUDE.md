# API - Elysia Backend

## Stack

- **Framework**: Elysia (Bun-native web framework)
- **Runtime**: Bun
- **Default port**: 3333

## Code Patterns

### Creating Endpoints

Elysia uses a fluent API for route definition:

```ts
import { Elysia } from "elysia"

const app = new Elysia()
  .get("/route", () => "response")
  .post("/route", ({ body }) => { ... })
  .listen(3000)
```

### Validation with Zod

**IMPORTANT:** Use Zod v4 for schema validation, NOT Typebox (`t` from Elysia). Elysia supports Zod out-of-the-box.

**IMPORTANT:** Define schemas inline directly in the route options. Do NOT create shared schema files or variables. Duplicate schemas across route files is acceptable and preferred.

```ts
import { Elysia } from "elysia"
import { z } from "zod"

app.post("/posts", ({ body }) => body, {
  body: z.object({
    title: z.string().min(1),
    content: z.string().min(1),
  }),
  query: z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
  }),
  params: z.object({
    id: z.string(),
  }),
  response: {
    200: z.object({
      id: z.string(),
      title: z.string(),
    }),
  },
})
```

### Plugins and Modules

For organization, use Elysia plugins to separate routes by domain:

```ts
const usersPlugin = new Elysia({ prefix: "/users" })
  .get("/", () => [...])
  .get("/:id", ({ params }) => {...})

app.use(usersPlugin)
```

## Scripts

- `bun run dev` - Development server with hot reload (--watch)
