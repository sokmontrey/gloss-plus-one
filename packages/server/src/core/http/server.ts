import type { Express } from 'express'

import { createApp } from '../../app.js'
import { errorHandler, notFound } from './middleware.js'
import type { AppConfig } from '../config/config.js'

export function createServer(_config: AppConfig): { app: Express } {
  const app = createApp()

  app.use(notFound)
  app.use(errorHandler)

  return { app }
}

