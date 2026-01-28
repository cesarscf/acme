# Lib - Shared Utilities

## Auth Client (`auth-client.ts`)

Client-side authentication using [Better Auth](https://www.better-auth.com/) React integration.

### Exports

- `authClient` - Full auth client instance
- `useSession` - React hook for session state
- `signOut` - Sign out function
- `phoneAuth` - Phone number authentication methods

### Phone Authentication Flow

```tsx
import { phoneAuth, useSession, signOut } from "@/lib/auth-client"

// 1. Send OTP to phone
await phoneAuth.sendOtp({ phoneNumber: "+5511999999999" })

// 2. Verify OTP (creates user + session)
await phoneAuth.verify({
  phoneNumber: "+5511999999999",
  code: "123456"
})

// 3. Check session
const { data: session, isPending } = useSession()

// 4. Sign out
await signOut()
```

### Configuration

The client connects to the API URL defined in environment:

```
VITE_API_URL=http://localhost:3333
```
