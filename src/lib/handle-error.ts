import { toast } from "sonner"
import * as z from "zod"

const unknownError = "Ocorreu um erro inesperado. Tente novamente."

export function getErrorMessage(err: unknown) {
  if (err instanceof z.ZodError) {
    return err.issues[0]?.message ?? unknownError
  } else if (err instanceof Error) {
    return err.message
  } else {
    return unknownError
  }
}

export function showErrorToast(err: unknown) {
  return toast.error(getErrorMessage(err))
}
