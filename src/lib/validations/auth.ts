import { z } from "zod/v4"

export const emailSchema = z.object({
  email: z.email("Email inválido"),
})

export const otpSchema = z.object({
  email: z.email("Email inválido"),
  otp: z.string().length(4, "O código deve ter 4 dígitos"),
})

export type AuthState = {
  step: "email" | "otp"
  email?: string
  errors: null | Partial<Record<"email" | "otp", string[]>>
  success?: boolean
}
