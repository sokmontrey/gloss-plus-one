import { Router } from 'express'

import type { AuthController } from './auth-controller.js'
import type { RequestHandler } from 'express'

export function buildAuthRoutes(params: { controller: AuthController; requireAuth: RequestHandler }): Router {
  const { controller, requireAuth } = params
  const router = Router()

  router.get('/auth/google/start', controller.googleStart)
  router.get('/auth/callback', controller.callback)
  router.get('/auth/me', requireAuth, controller.me)
  router.post('/auth/logout', requireAuth, controller.logout)

  return router
}
