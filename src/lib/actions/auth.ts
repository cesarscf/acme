"use server"

import { auth } from "../auth"
import { getErrorMessage } from "../handle-error"
import type { EmailSchema, OtpSchema } from "../validations/auth"

export async function sendEmailOtp(input: EmailSchema) {
  try {
    await auth.api.sendVerificationOTP({
      body: {
        email: input.email,
        type: "sign-in",
      },
    })

    return { data: true, error: null }
  } catch (err) {
    return { data: null, error: getErrorMessage(err) }
  }
}

export async function verifyEmailOtp(input: OtpSchema) {
  try {
    await auth.api.signInEmailOTP({
      body: {
        email: input.email,
        otp: input.otp,
      },
    })

    return { data: true, error: null }
  } catch (err) {
    return { data: null, error: getErrorMessage(err) }
  }
}
