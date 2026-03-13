"use client"

import { useActionState } from "react"
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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

  const isOtpStep = emailState.step === "otp"
  const state = isOtpStep ? otpState : emailState

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
          </>
        )}
      </CardContent>
    </Card>
  )
}
