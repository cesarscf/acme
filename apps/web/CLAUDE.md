# Web App - React Frontend

## Stack

- **Framework**: React 19 with TypeScript
- **Bundler**: Vite 7
- **Styling**: Tailwind CSS 4
- **UI Components**: Base UI + shadcn/ui patterns

## Code Patterns

### React Components

- Use **named exports** for components (not default exports)
- Components should be functions (function components)

```tsx
// Correct
export function MyComponent() {
  return <div>...</div>
}

// Avoid
export default function MyComponent() { ... }
```

### Path Aliases

The project uses the `@/*` alias pointing to `./src/`. Always prefer imports with alias:

```tsx
import { Button } from "@/components/ui/button"
```

### Styling

- Use Tailwind CSS classes directly in components
- For component variants, use `class-variance-authority` (cva)
- `cn()` utility available for conditional class merging

## Scripts

- `bun run dev` - Development server (port 3000)
- `bun run build` - Production build
- `bun run preview` - Build preview
