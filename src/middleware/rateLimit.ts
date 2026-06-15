import type { MiddlewareHandler } from 'hono'
import { env } from '../config/env.js'
import { logger } from '../lib/logger.js'

interface RateLimitStore {
  count: number
  resetAt: number
}

// Almacén en memoria — solo para desarrollo.
// En producción, reemplazar con Upstash Redis.
const store = new Map<string, RateLimitStore>()

function inMemoryLimit(maxRequests: number, windowMs: number): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      ?? c.req.header('x-real-ip')
      ?? 'unknown'

    const key = `${ip}:${c.req.path}`
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    if (entry.count >= maxRequests) {
      logger.warn('Rate limit excedido', { ip, path: c.req.path })
      return c.json({ error: 'Demasiadas solicitudes. Intenta más tarde.' }, 429)
    }

    entry.count++
    return next()
  }
}

// Límite público: 60 req / minuto por IP
export const publicRateLimit: MiddlewareHandler =
  env.NODE_ENV === 'production'
    ? inMemoryLimit(60, 60_000)   // TODO: reemplazar con Upstash en producción
    : async (_c, next) => next()  // Sin límite en desarrollo

// Límite para endpoints de escritura pública (contacto, carrito): 10 req / minuto
export const writeRateLimit: MiddlewareHandler =
  env.NODE_ENV === 'production'
    ? inMemoryLimit(10, 60_000)
    : async (_c, next) => next()

// Límite de login admin: 5 intentos / 15 minutos
export const authRateLimit: MiddlewareHandler =
  env.NODE_ENV === 'production'
    ? inMemoryLimit(5, 15 * 60_000)
    : async (_c, next) => next()
