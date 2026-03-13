"use client"

import * as React from "react"
import { useForm } from "@tanstack/react-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { Spinner } from "@/components/ui/spinner"
import { sendEmailOtp, verifyEmailOtp } from "@/lib/actions/auth"
import { emailSchema } from "@/lib/validations/auth"

export function LoginForm() {
  const router = useRouter()
  const [step, setStep] = React.useState<"email" | "otp">("email")
  const [email, setEmail] = React.useState("")
  const [isEmailPending, startEmailTransition] = React.useTransition()
  const [isOtpPending, startOtpTransition] = React.useTransition()

  const emailForm = useForm({
    defaultValues: {
      email: "",
    },
    validators: {
      onSubmit: emailSchema,
    },
    onSubmit: ({ value }) => {
      startEmailTransition(async () => {
        const { error } = await sendEmailOtp(value)

        if (error) {
          toast.error(error)
          return
        }

        setEmail(value.email)
        setStep("otp")
      })
    },
  })

  const otpForm = useForm({
    defaultValues: {
      otp: "",
    },
    onSubmit: ({ value }) => {
      startOtpTransition(async () => {
        const { error } = await verifyEmailOtp({
          email,
          otp: value.otp,
        })

        if (error) {
          toast.error(error)
          return
        }

        router.push("/dashboard")
      })
    },
  })

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>
          {step === "otp"
            ? `Digite o código enviado para ${email}`
            : "Digite seu email para continuar"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "otp" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              otpForm.handleSubmit()
            }}
          >
            <FieldGroup>
              <otpForm.Field
                name="otp"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Código</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="0000"
                        maxLength={4}
                        autoFocus
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        disabled={isOtpPending}
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
              <Button type="submit" disabled={isOtpPending}>
                {isOtpPending && <Spinner />}
                Verificar
              </Button>
            </FieldGroup>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              emailForm.handleSubmit()
            }}
          >
            <FieldGroup>
              <emailForm.Field
                name="email"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="seu@email.com"
                        autoFocus
                        autoComplete="email"
                        disabled={isEmailPending}
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
              <Button type="submit" disabled={isEmailPending}>
                {isEmailPending && <Spinner />}
                Continuar
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
