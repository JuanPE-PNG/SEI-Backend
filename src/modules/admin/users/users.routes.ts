import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, requireSuperAdmin } from '../../../middleware/auth.js'
import {
  createAdminUserSchema,
  updateAdminUserSchema,
  listAdminUsers,
  getAdminUserById,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
} from './users.service.js'

const adminUsers = new Hono()

adminUsers.use('*', requireAuth, requireSuperAdmin)

// GET /api/v1/admin/users
adminUsers.get('/', async (c) => {
  const result = await listAdminUsers()
  return c.json(result)
})

// POST /api/v1/admin/users
adminUsers.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createAdminUserSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  try {
    const data = await createAdminUser(parsed.data, c.get('adminId'))
    return c.json({ data }, 201)
  } catch (err) {
    if (err instanceof Error) return c.json({ error: err.message }, 409)
    throw err
  }
})

// GET /api/v1/admin/users/:id
adminUsers.get('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  const data = await getAdminUserById(c.req.param('id'))
  if (!data) return c.json({ error: 'Usuario no encontrado' }, 404)
  return c.json({ data })
})

// PUT /api/v1/admin/users/:id
adminUsers.put('/:id', async (c) => {
  const id = c.req.param('id')
  if (!z.string().uuid().safeParse(id).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = updateAdminUserSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  if (id === c.get('adminId') && parsed.data.is_active === false) {
    return c.json({ error: 'No puedes desactivar tu propia cuenta' }, 400)
  }

  const data = await updateAdminUser(id, parsed.data)
  if (!data) return c.json({ error: 'Usuario no encontrado' }, 404)
  return c.json({ data })
})

// DELETE /api/v1/admin/users/:id
adminUsers.delete('/:id', async (c) => {
  const id = c.req.param('id')
  if (!z.string().uuid().safeParse(id).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  if (id === c.get('adminId')) {
    return c.json({ error: 'No puedes eliminar tu propia cuenta' }, 400)
  }

  await deleteAdminUser(id)
  return c.json({ data: { deleted: true } })
})

export default adminUsers
