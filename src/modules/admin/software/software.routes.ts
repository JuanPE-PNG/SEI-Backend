import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth } from '../../../middleware/auth.js'
import {
  adminSoftwareListSchema,
  softwareBodySchema,
  softwareUpdateSchema,
  listAdminSoftware,
  getAdminSoftwareById,
  createSoftware,
  updateSoftware,
  deleteSoftware,
} from './software.service.js'

const adminSoftware = new Hono()

adminSoftware.use('*', requireAuth)

adminSoftware.get('/', async (c) => {
  const parsed = adminSoftwareListSchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  const result = await listAdminSoftware(parsed.data)
  return c.json(result)
})

adminSoftware.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = softwareBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  try {
    const data = await createSoftware(parsed.data)
    return c.json({ data }, 201)
  } catch (err) {
    if (err instanceof Error) return c.json({ error: err.message }, 409)
    throw err
  }
})

adminSoftware.get('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  const data = await getAdminSoftwareById(c.req.param('id'))
  if (!data) return c.json({ error: 'Software no encontrado' }, 404)
  return c.json({ data })
})

adminSoftware.put('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = softwareUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  try {
    const data = await updateSoftware(c.req.param('id'), parsed.data)
    if (!data) return c.json({ error: 'Software no encontrado' }, 404)
    return c.json({ data })
  } catch (err) {
    if (err instanceof Error) return c.json({ error: err.message }, 409)
    throw err
  }
})

adminSoftware.delete('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  await deleteSoftware(c.req.param('id'))
  return c.json({ data: { deleted: true } })
})

export default adminSoftware
