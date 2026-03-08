export type FormState<T extends Record<string, unknown>> = {
  values?: T
  errors: null | Partial<Record<keyof T | "_root", string[]>>
  success: boolean
}
