import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { phoneNumber } from "better-auth/plugins"
import { db } from "@/database"
import { env } from "@/env"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  plugins: [
    phoneNumber({
      signUpOnVerification: {
        getTempEmail(phoneNumber) {
          return `${phoneNumber}@acme.com`
        },
      },
      async sendOTP({ phoneNumber, code }) {
        if (env.NODE_ENV === "development") {
          console.log(`[OTP] Phone: ${phoneNumber}, Code: ${code}`)
        }
      },
    }),
  ],
})
