"use client"

import { useActionState } from "react"
import { redirect } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type AuthState, sendOtp, verifyOtp } from "@/lib/actions/auth"

const initialState: AuthState = { step: "email" }

export default function LoginPage() {
  const [emailState, emailAction, emailPending] = useActionState(
    sendOtp,
    initialState
  )

  const otpInitialState: AuthState = {
    step: "otp",
    email: emailState.email,
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
            ? `Digite o codigo enviado para ${emailState.email}`
            : "Digite seu email para continuar"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isOtpStep ? (
          <form action={otpAction} className="grid gap-4">
            <input type="hidden" name="email" value={emailState.email} />
            <div className="grid gap-2">
              <Label htmlFor="otp">Codigo</Label>
              <Input
                id="otp"
                name="otp"
                placeholder="0000"
                maxLength={4}
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
              />
              {state.errors?.otp && (
                <p className="text-sm text-destructive">{state.errors.otp}</p>
              )}
            </div>
            <Button type="submit" disabled={otpPending}>
              {otpPending && <Loader2 className="animate-spin" />}
              Verificar
            </Button>
          </form>
        ) : (
          <form action={emailAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                defaultValue={emailState.email}
                autoFocus
                autoComplete="email"
              />
              {state.errors?.email && (
                <p className="text-sm text-destructive">
                  {state.errors.email}
                </p>
              )}
            </div>
            <Button type="submit" disabled={emailPending}>
              {emailPending && <Loader2 className="animate-spin" />}
              Continuar
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
