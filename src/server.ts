import { serve } from '@hono/node-server'
import app from './app.js'
import { logger } from './lib/logger.js'
import { env } from './config/env.js'

const PORT = 3001

serve({ fetch: app.fetch, port: PORT }, () => {
  logger.info(`SEI Backend corriendo en http://localhost:${PORT}/api`, {
    env: env.NODE_ENV,
  })
})
