import { createAuthClient } from "better-auth/react"
import { emailOTPClient, inferOrgAdditionalFields, organizationClient } from "better-auth/client/plugins"
import { auth } from "./auth"

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), organizationClient(
    {
       schema: inferOrgAdditionalFields<typeof auth>(),
    }
  )],
})
