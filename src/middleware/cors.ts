import { cors } from 'hono/cors'
import { env } from '../config/env.js'

export const corsMiddleware = cors({
  origin: (origin) => {
    // Requests sin Origin header (server-to-server, curl) — permitir en dev, bloquear en prod
    if (!origin) {
      return env.NODE_ENV === 'development' ? '*' : null
    }
    return env.ALLOWED_ORIGINS.includes(origin) ? origin : null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'],
  exposeHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 86400,       // 24h cache del preflight
  credentials: true,
})
