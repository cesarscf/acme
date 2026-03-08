import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { emailOTP } from "better-auth/plugins"

import { db } from "@/db"
import * as schema from "@/db/schemas/auth"
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
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`[OTP] ${email} (${type}): ${otp}`)
      },
      otpLength: 4,
      disableSignUp: false,
    }),
    nextCookies(),
  ],
})
