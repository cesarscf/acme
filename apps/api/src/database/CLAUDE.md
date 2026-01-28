# Database - Drizzle ORM

## Stack

- **ORM**: Drizzle ORM
- **Driver**: postgres (native PostgreSQL driver)
- **Migrations**: Drizzle Kit

## Structure

```
database/
├── index.ts           # Database instance (db)
├── migrations/        # Generated migrations (drizzle-kit)
└── schema/
    ├── index.ts       # Barrel export (re-exports all schemas)
    └── *.ts           # Individual schema files
```

## Naming Conventions

- Use **snake_case** for table and column names
- Use **plural** for table names

```ts
// Correct
export const user_profiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  display_name: text("display_name"),
  created_at: timestamp("created_at").notNull().defaultNow(),
})

// Wrong
export const UserProfile = pgTable("UserProfile", {  // PascalCase
  userId: uuid("userId"),                            // camelCase
})
```

## Code Patterns

### Creating a New Schema

1. Create a new file in `schema/` (e.g., `posts.ts`)
2. Export the table from the barrel file `schema/index.ts`

```ts
// schema/posts.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content"),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})
```

```ts
// schema/index.ts
export * from "./users"
export * from "./posts"
```

### Querying

```ts
import { db } from "@/database"
import { users, posts } from "@/database/schema"
import { eq } from "drizzle-orm"

// Select all
const allUsers = await db.select().from(users)

// Select with filter
const user = await db.select().from(users).where(eq(users.id, id))

// Insert
const [newUser] = await db.insert(users).values({ email, name }).returning()

// Update
await db.update(users).set({ name }).where(eq(users.id, id))

// Delete
await db.delete(users).where(eq(users.id, id))

// Relations (with schema inference)
const usersWithPosts = await db.query.users.findMany({
  with: { posts: true },
})
```

## Drizzle Kit Commands

```bash
bunx drizzle-kit generate   # Generate migrations from schema changes
bunx drizzle-kit migrate    # Apply pending migrations
bunx drizzle-kit studio     # Open Drizzle Studio (visual interface)
bunx drizzle-kit push       # Push schema directly (dev only)
```
