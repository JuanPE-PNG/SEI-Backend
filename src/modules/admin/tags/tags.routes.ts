import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth } from '../../../middleware/auth.js'
import {
  adminTagsListSchema,
  tagBodySchema,
  tagUpdateSchema,
  listAdminTags,
  getAdminTagById,
  createTag,
  updateTag,
  deleteTag,
} from './tags.service.js'

const adminTags = new Hono()

adminTags.use('*', requireAuth)

// GET /api/v1/admin/tags
adminTags.get('/', async (c) => {
  const parsed = adminTagsListSchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  const result = await listAdminTags(parsed.data)
  return c.json(result)
})

// POST /api/v1/admin/tags
adminTags.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = tagBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  try {
    const data = await createTag(parsed.data)
    return c.json({ data }, 201)
  } catch (err) {
    if (err instanceof Error) return c.json({ error: err.message }, 409)
    throw err
  }
})

// GET /api/v1/admin/tags/:id
adminTags.get('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  const data = await getAdminTagById(c.req.param('id'))
  if (!data) return c.json({ error: 'Tag no encontrado' }, 404)
  return c.json({ data })
})

// PUT /api/v1/admin/tags/:id
adminTags.put('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = tagUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  try {
    const data = await updateTag(c.req.param('id'), parsed.data)
    if (!data) return c.json({ error: 'Tag no encontrado' }, 404)
    return c.json({ data })
  } catch (err) {
    if (err instanceof Error) return c.json({ error: err.message }, 409)
    throw err
  }
})

// DELETE /api/v1/admin/tags/:id
adminTags.delete('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  await deleteTag(c.req.param('id'))
  return c.json({ data: { deleted: true } })
})

export default adminTags
