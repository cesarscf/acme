"use client"

import { useActionState, useState } from "react"
import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { authClient } from "@/lib/auth-client"
import { sendOtp, verifyOtp } from "@/lib/actions/auth"
import type { AuthState } from "@/lib/validations/auth"

const initialState: AuthState = { step: "email", errors: null }

export default function LoginPage() {
  const [emailState, emailAction, emailPending] = useActionState(
    sendOtp,
    initialState
  )

  const otpInitialState: AuthState = {
    step: "otp",
    email: emailState.email,
    errors: null,
  }

  const [otpState, otpAction, otpPending] = useActionState(
    verifyOtp,
    otpInitialState
  )

  if (otpState.success) {
    redirect("/dashboard")
  }

  const [googleLoading, setGoogleLoading] = useState(false)

  const isOtpStep = emailState.step === "otp"
  const state = isOtpStep ? otpState : emailState

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>
          {isOtpStep
            ? `Digite o código enviado para ${emailState.email}`
            : "Digite seu email para continuar"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isOtpStep ? (
          <form action={otpAction}>
            <input type="hidden" name="email" value={emailState.email} />
            <FieldGroup>
              <Field data-invalid={!!state.errors?.otp?.length}>
                <FieldLabel htmlFor="otp">Código</FieldLabel>
                <Input
                  id="otp"
                  name="otp"
                  placeholder="0000"
                  maxLength={4}
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  disabled={otpPending}
                  aria-invalid={!!state.errors?.otp?.length}
                />
                {state.errors?.otp && (
                  <FieldError>{state.errors.otp[0]}</FieldError>
                )}
              </Field>
              <Button type="submit" disabled={otpPending}>
                {otpPending && <Spinner />}
                Verificar
              </Button>
            </FieldGroup>
          </form>
        ) : (
          <>
          <form action={emailAction}>
            <FieldGroup>
              <Field data-invalid={!!state.errors?.email?.length}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  defaultValue={emailState.email}
                  autoFocus
                  autoComplete="email"
                  disabled={emailPending}
                  aria-invalid={!!state.errors?.email?.length}
                />
                {state.errors?.email && (
                  <FieldError>{state.errors.email[0]}</FieldError>
                )}
              </Field>
              <Button type="submit" disabled={emailPending}>
                {emailPending && <Spinner />}
                Continuar
              </Button>
            </FieldGroup>
          </form>

          <div className="flex items-center gap-3 py-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">ou</span>
            <Separator className="flex-1" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Spinner />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continuar com Google
          </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
