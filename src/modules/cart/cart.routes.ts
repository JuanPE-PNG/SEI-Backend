import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { writeRateLimit } from '../../middleware/rateLimit.js'
import {
  getOrCreateCart,
  getCart,
  addCartItem,
  removeCartItem,
  checkoutCart,
  addItemSchema,
  CartNotFoundError,
  CartEmptyError,
} from './cart.service.js'

const cart = new Hono()

function extractToken(c: Context<any>): string | null {
  const token = c.req.header('X-Session-Token')
  if (!token || token.trim().length < 10) return null
  return token.trim()
}

const NO_TOKEN = { error: 'X-Session-Token header requerido (mínimo 10 caracteres)' } as const

// obtener o crear carrito
cart.post('/', writeRateLimit, async (c) => {
  const token = extractToken(c)
  if (!token) return c.json(NO_TOKEN, 401)

  const data = await getOrCreateCart(token)
  return c.json({ data })
})

cart.get('/', async (c) => {
  const token = extractToken(c)
  if (!token) return c.json(NO_TOKEN, 401)

  const data = await getCart(token)
  if (!data) return c.json({ error: 'Carrito no encontrado o expirado' }, 404)

  return c.json({ data })
})

cart.post('/items', writeRateLimit, async (c) => {
  const token = extractToken(c)
  if (!token) return c.json(NO_TOKEN, 401)

  const body = await c.req.json().catch(() => null)
  const parsed = addItemSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  try {
    const data = await addCartItem(token, parsed.data)
    return c.json({ data }, 201)
  } catch (err) {
    if (err instanceof CartNotFoundError) return c.json({ error: err.message }, 404)
    if (err instanceof Error) return c.json({ error: err.message }, 422)
    throw err
  }
})

cart.delete('/items/:itemId', writeRateLimit, async (c) => {
  const token = extractToken(c)
  if (!token) return c.json(NO_TOKEN, 401)

  const itemId = c.req.param('itemId')
  if (!z.string().uuid().safeParse(itemId).success) {
    return c.json({ error: 'ID de ítem inválido' }, 400)
  }

  try {
    await removeCartItem(token, itemId)
    return c.json({ data: { deleted: true } })
  } catch (err) {
    if (err instanceof CartNotFoundError) return c.json({ error: err.message }, 404)
    throw err
  }
})

// generar URL de WhatsApp y guardar log
cart.post('/checkout', writeRateLimit, async (c) => {
  const token = extractToken(c)
  if (!token) return c.json(NO_TOKEN, 401)

  try {
    const data = await checkoutCart(token)
    return c.json({ data })
  } catch (err) {
    if (err instanceof CartNotFoundError) return c.json({ error: err.message }, 404)
    if (err instanceof CartEmptyError)    return c.json({ error: err.message }, 400)
    throw err
  }
})

export default cart
