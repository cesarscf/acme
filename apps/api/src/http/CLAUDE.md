# HTTP - Elysia Server

## Structure

```
http/
├── server.ts          # Main entry point
├── plugins/           # Elysia plugins
│   ├── auth.ts        # Authentication plugin with macro
│   └── cors.ts        # CORS configuration
└── routes/            # Route modules (future)
```

## Server Entry Point

**File**: `server.ts`

The server configures:
- CORS for `http://localhost:3000` with credentials
- Auth plugin with Better Auth integration
- Base routes

## Plugins

### CORS Plugin (`plugins/cors.ts`)

Configures CORS for frontend communication.

- **Origin**: `http://localhost:3000`
- **Credentials**: Enabled (required for auth cookies)

### Auth Plugin (`plugins/auth.ts`)

Provides authentication via Better Auth with an Elysia macro.

**Features**:
- Mounts Better Auth handler at `/api/auth/*`
- Provides `auth` macro for protected routes

**Usage**:

```ts
import { authPuglin } from "./plugins/auth"

const app = new Elysia()
  .use(authPuglin)
  // Public route
  .get("/public", () => "Hello")
  // Protected route - requires auth macro
  .get("/protected", ({ user, session }) => {
    return { userId: user.id }
  }, { auth: true })
```

**Macro Behavior**:
- Returns `401` if no session
- Injects `user` and `session` into context when authenticated

## Creating New Plugins

1. Create file in `plugins/` folder
2. Export an Elysia instance with a unique name
3. Use in `server.ts` with `.use()`

```ts
// plugins/my-plugin.ts
import { Elysia } from "elysia"

export const myPlugin = new Elysia({ name: "my-plugin" })
  .derive(() => ({ /* context */ }))
  .macro({ /* macros */ })
```

## Creating Routes

Place route modules in `routes/` folder and mount them in `server.ts`:

```ts
// routes/users.ts
import { Elysia } from "elysia"

export const usersRoutes = new Elysia({ prefix: "/users" })
  .get("/", () => [...])
  .get("/:id", ({ params }) => {...})
```
