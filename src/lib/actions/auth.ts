"use server"

import { z } from "zod/v4"
import { authClient } from "@/lib/auth-client"
import { emailSchema, otpSchema } from "@/lib/validations/auth"

export type AuthState = {
  step: "email" | "otp"
  email?: string
  errors?: Record<string, string>
  success?: boolean
  message?: string
}

export async function sendOtp(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const result = emailSchema.safeParse({
    email: formData.get("email"),
  })

  const email = formData.get("email") as string

  if (!result.success) {
    return {
      step: "email",
      email,
      errors: Object.fromEntries(
        Object.entries(z.flattenError(result.error).fieldErrors).map(
          ([key, messages]) => [key, messages?.[0] ?? ""]
        )
      ),
    }
  }

  const { error } = await authClient.emailOtp.sendVerificationOtp({
    email: result.data.email,
    type: "sign-in",
  })

  if (error) {
    return {
      step: "email",
      email,
      errors: { email: error.message ?? "Erro ao enviar o codigo" },
    }
  }

  return { step: "otp", email: result.data.email }
}

export async function verifyOtp(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const result = otpSchema.safeParse({
    email: formData.get("email"),
    otp: formData.get("otp"),
  })

  if (!result.success) {
    return {
      step: "otp",
      email: formData.get("email") as string,
      errors: Object.fromEntries(
        Object.entries(z.flattenError(result.error).fieldErrors).map(
          ([key, messages]) => [key, messages?.[0] ?? ""]
        )
      ),
    }
  }

  const { email, otp } = result.data

  const { error } = await authClient.signIn.emailOtp({
    email,
    otp,
  })

  if (error) {
    return {
      step: "otp",
      email,
      errors: { otp: error.message ?? "Código inválido" },
    }
  }

  return { step: "otp", email, success: true }
}
