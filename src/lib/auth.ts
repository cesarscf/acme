import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { emailOTP } from "better-auth/plugins"
import { organization } from "better-auth/plugins/organization"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { env } from "@/env"
import { nextCookies } from "better-auth/next-js"

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`[OTP] ${email} (${type}): ${otp}`)
      },
      otpLength: 4,
      disableSignUp: false,
    }),
    organization({
      allowUserToCreateOrganization: true,
      schema: {
        organization: {
          additionalFields: {
            customDomain: { type: "string", required: false, unique: true },
            domainVerified: { type: "boolean", required: false, defaultValue: false },
          },
        },
      },
    }),
    nextCookies(),
  ],
})
