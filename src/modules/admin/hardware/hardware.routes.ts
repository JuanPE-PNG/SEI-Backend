import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth } from '../../../middleware/auth.js'
import {
  adminHardwareListSchema,
  hardwareBodySchema,
  hardwareUpdateSchema,
  listAdminHardware,
  getAdminHardwareById,
  createHardware,
  updateHardware,
  deleteHardware,
} from './hardware.service.js'

const adminHardware = new Hono()

adminHardware.use('*', requireAuth)

adminHardware.get('/', async (c) => {
  const parsed = adminHardwareListSchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  const result = await listAdminHardware(parsed.data)
  return c.json(result)
})

adminHardware.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = hardwareBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  try {
    const data = await createHardware(parsed.data)
    return c.json({ data }, 201)
  } catch (err) {
    if (err instanceof Error) return c.json({ error: err.message }, 409)
    throw err
  }
})

adminHardware.get('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  const data = await getAdminHardwareById(c.req.param('id'))
  if (!data) return c.json({ error: 'Hardware no encontrado' }, 404)
  return c.json({ data })
})

adminHardware.put('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = hardwareUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  try {
    const data = await updateHardware(c.req.param('id'), parsed.data)
    if (!data) return c.json({ error: 'Hardware no encontrado' }, 404)
    return c.json({ data })
  } catch (err) {
    if (err instanceof Error) return c.json({ error: err.message }, 409)
    throw err
  }
})

adminHardware.delete('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  await deleteHardware(c.req.param('id'))
  return c.json({ data: { deleted: true } })
})

export default adminHardware
