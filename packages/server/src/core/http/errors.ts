import { ZodError } from 'zod'

export class AppError extends Error {
  readonly code: string
  readonly status: number
  readonly expose: boolean

  constructor(code: string, message: string, status = 400, expose = true) {
    super(message)
    this.code = code
    this.status = status
    this.expose = expose
  }
}

export class HttpError extends AppError {
  constructor(status: number, message: string, expose = true) {
    super('http_error', message, status, expose)
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  if (err instanceof ZodError)
    return new AppError('bad_request', err.issues.map((i) => i.message).join(', '), 400)
  return new AppError('internal_error', 'Internal Server Error', 500, false)
}

