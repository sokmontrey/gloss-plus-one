import type { NextFunction, Request, Response } from 'express'
import { AppError, toAppError } from './errors.js'
import type { AuthService } from '../../features/auth/auth-service.js'

export function createRequireAuth(authService: AuthService) {
  return async function requireAuth(req: Request, _res: Response, next: NextFunction) {
    try {
      const sid = (req.signedCookies?.[authService.cookieName] as string | undefined) ?? undefined
      req.auth = await authService.resolveAuthContextBySid(sid)
      next()
    } catch (err) {
      next(err)
    }
  }
}

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError('not_found', `Route not found: ${req.method} ${req.path}`, 404))
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const appErr = toAppError(err)

  res.status(appErr.status).json({
    error: appErr.code,
    message: appErr.message,
  })
}

