# Lib - Shared Utilities

## Overview

This folder contains shared utilities and integrations used across the API.

## Auth (Better Auth)

**File**: `auth.ts`

Authentication is handled by [Better Auth](https://www.better-auth.com/) with phone number OTP as the only authentication method.

### Configuration

- **Database**: Drizzle adapter with `usePlural: true` (tables: `users`, `sessions`, `accounts`, `verifications`)
- **Auth Method**: Phone number with OTP (email/password disabled)
- **Sign Up**: Automatic on verification (`signUpOnVerification`)

### OTP Behavior

In development, OTP codes are logged to console:
```
[OTP] Phone: +5511999999999, Code: 123456
```

### Usage in Plugins

Import and use `auth` for session management:

```ts
import { auth } from "@/lib/auth"

// Get session from headers
const session = await auth.api.getSession({ headers })

// Mount handler for auth routes
app.mount(auth.handler)
```

### Environment Variables

Required in `.env`:
```
BETTER_AUTH_SECRET=your-secret-key
```

Generate with: `openssl rand -base64 32`
