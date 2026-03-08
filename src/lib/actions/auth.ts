"use server"

import { headers } from "next/headers"
import { z } from "zod/v4"

import { auth } from "@/lib/auth"
import { emailSchema, otpSchema } from "@/lib/validations/auth"
import type { AuthState } from "@/lib/validations/auth"

export async function sendOtp(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email") as string

  const result = emailSchema.safeParse({ email })

  if (!result.success) {
    return {
      step: "email",
      email,
      errors: z.flattenError(result.error).fieldErrors,
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
      errors: { email: ["Erro ao enviar o codigo"] },
    }
  }

  return { step: "otp", email: result.data.email, errors: null }
}

export async function verifyOtp(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email") as string
  const otp = formData.get("otp") as string

  const result = otpSchema.safeParse({ email, otp })

  if (!result.success) {
    return {
      step: "otp",
      email,
      errors: z.flattenError(result.error).fieldErrors,
    }
  }

  try {
    await auth.api.signInEmailOTP({
      body: { email: result.data.email, otp: result.data.otp },
      headers: await headers(),
    })
  } catch {
    return {
      step: "otp",
      email,
      errors: { otp: ["Codigo invalido"] },
    }
  }

  return { step: "otp", email, errors: null, success: true }
}
