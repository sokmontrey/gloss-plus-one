import type { Request, Response } from 'express'

import type { AuthService } from './auth-service.js'
import { HttpError } from '../../core/http/errors.js'

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  googleStart = async (req: Request, res: Response) => {
    const start = await this.authService.beginGoogleAuth(req.query.returnTo as string | undefined)
    res.redirect(start.authorizationUrl)
  }

  callback = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined
    const state = typeof req.query.state === 'string' ? req.query.state : undefined
    if (!code || !state) throw new HttpError(400, 'Missing code/state')

    const done = await this.authService.completeGoogleAuth({ code, state })

    res.cookie(this.authService.cookieName, done.cookie.value, done.cookie.options)
    res.setHeader('Cache-Control', 'private, no-store')
    res.redirect(done.redirectTo)
  }

  me = async (req: Request, res: Response) => {
    if (!req.auth) throw new HttpError(401, 'Not authenticated')
    res.setHeader('Cache-Control', 'private, no-store')
    res.json({
      userId: req.auth.userId,
      email: req.auth.email,
    })
  }

  logout = async (req: Request, res: Response) => {
    const sid = (req.signedCookies?.[this.authService.cookieName] as string | undefined) ?? undefined
    await this.authService.logout(sid)
    res.clearCookie(this.authService.cookieName, this.authService.cookieClearOptions)
    res.setHeader('Cache-Control', 'private, no-store')
    res.status(204).send()
  }
}
