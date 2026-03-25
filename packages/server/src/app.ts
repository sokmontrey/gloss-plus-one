import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'

import { getConfig } from './core/config/config.js'
import { getContainer } from './di/container.js'

export function createApp() {
  const config = getConfig()
  const container = getContainer()

  const app = express()

  app.disable('x-powered-by')

  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser(config.cookie.secret))

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use(container.authRoutes)

  return app
}

