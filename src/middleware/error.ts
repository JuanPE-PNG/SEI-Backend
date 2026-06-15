import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from '../lib/logger.js'
import { env } from '../config/env.js'

export const errorHandler: ErrorHandler = (err, c) => {
  // Errores HTTP controlados (lanzados explícitamente con HTTPException)
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }

  // Error inesperado — loguear con contexto pero nunca exponer el stack al cliente
  logger.error('Error no controlado', {
    message: err.message,
    stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: c.req.path,
    method: c.req.method,
  })

  return c.json(
    { error: 'Error interno del servidor.' },
    500
  )
}
