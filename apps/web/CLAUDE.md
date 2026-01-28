# Web App - React Frontend

## Stack

- **Framework**: React 19 with TypeScript
- **Bundler**: Vite 7
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui (Base UI primitives)
- **Routing**: TanStack Router (file-based routing)
- **Data Fetching**: TanStack Query

## Code Patterns

### React Components

- Use **named exports** for components (not default exports)
- Components should be functions (function components)
- **Always use `function` declarations**, avoid arrow functions with `const`
- **Use `React.useState`, `React.useEffect`, etc.** instead of destructured imports

```tsx
// Correct
import React from "react"

export function MyComponent() {
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    // ...
  }, [])

  return <div>{count}</div>
}

// Avoid
import { useState, useEffect } from "react"

const MyComponent = () => {
  const [count, setCount] = useState(0)
  // ...
}
```

### Path Aliases

The project uses the `@/*` alias pointing to `./src/`. Always prefer imports with alias:

```tsx
import { Button } from "@/components/ui/button"
```

### UI Components (shadcn/ui)

Components are located in `src/components/ui/`. To add new components, use the shadcn CLI:

```bash
bunx --bun shadcn@latest add button
bunx --bun shadcn@latest add card
bunx --bun shadcn@latest add dialog
```

Always use shadcn/ui components from `@/components/ui/` instead of creating custom ones.

### Styling

- Use Tailwind CSS classes directly in components
- For component variants, use `class-variance-authority` (cva)
- `cn()` utility available for conditional class merging

### Routing (TanStack Router)

Routes are file-based and located in `src/routes/`. The route tree is auto-generated in `src/route-tree.gen.ts`.

**Creating a new route:**

```tsx
// src/routes/about.tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/about")({
  component: AboutPage,
})

function AboutPage() {
  return <div>About</div>
}
```

**Route with params:**

```tsx
// src/routes/users/$userId.tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/users/$userId")({
  component: UserPage,
})

function UserPage() {
  const { userId } = Route.useParams()
  return <div>User {userId}</div>
}
```

**Nested layouts:** Create a `_layout.tsx` file or use folder structure with `__root.tsx` for shared layouts.

### Data Fetching (TanStack Query)

QueryClient is configured in `src/integrations/tanstack-query/` and provided via router context.

**Basic query:**

```tsx
import { useQuery } from "@tanstack/react-query"

function MyComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users").then(res => res.json()),
  })

  if (isLoading) return <div>Loading...</div>
  return <div>{data}</div>
}
```

**Mutation:**

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query"

function MyComponent() {
  const queryClient = useQueryClient()

  const { mutate } = useMutation({
    mutationFn: (data) => fetch("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  })
}
```

## Scripts

- `bun run dev` - Development server (port 3000)
- `bun run build` - Production build
- `bun run preview` - Build preview
