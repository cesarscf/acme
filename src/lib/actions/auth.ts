"use server"

import { headers } from "next/headers"
import { z } from "zod/v4"

import { auth } from "@/lib/auth"
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

  try {
    await auth.api.sendVerificationOTP({
      body: {
        email: result.data.email,
        type: "sign-in",
      },
    })
  } catch {
    return {
      step: "email",
      email,
      errors: { email: "Erro ao enviar o codigo" },
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

  try {
    await auth.api.signInEmailOTP({
      body: { email, otp },
      headers: await headers(),
    })
  } catch {
    return {
      step: "otp",
      email,
      errors: { otp: "Código inválido" },
    }
  }

  return { step: "otp", email, success: true }
}
