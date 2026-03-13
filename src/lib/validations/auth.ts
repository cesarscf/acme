import * as z from "zod"

export const emailSchema = z.object({
  email: z.email("Email inválido"),
})

export const otpSchema = z.object({
  email: z.email("Email inválido"),
  otp: z.string().length(4, "O código deve ter 4 dígitos"),
})

export type EmailSchema = z.infer<typeof emailSchema>
export type OtpSchema = z.infer<typeof otpSchema>
