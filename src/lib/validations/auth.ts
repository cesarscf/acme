import { z } from "zod/v4"

export const emailSchema = z.object({
  email: z.email("Email invalido"),
})

export const otpSchema = z.object({
  email: z.email("Email invalido"),
  otp: z.string().length(4, "O codigo deve ter 4 digitos"),
})

export type AuthState = {
  step: "email" | "otp"
  email?: string
  errors: null | Partial<Record<"email" | "otp", string[]>>
  success?: boolean
}
