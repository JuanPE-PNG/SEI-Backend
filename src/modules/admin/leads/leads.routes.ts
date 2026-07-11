import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth } from '../../../middleware/auth.js'
import {
  adminLeadsListSchema,
  leadUpdateSchema,
  listAdminLeads,
  getAdminLeadById,
  updateLeadStatus,
} from './leads.service.js'

const adminLeads = new Hono()

adminLeads.use('*', requireAuth)

// GET /api/v1/admin/leads
adminLeads.get('/', async (c) => {
  const parsed = adminLeadsListSchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  const result = await listAdminLeads(parsed.data)
  return c.json(result)
})

// GET /api/v1/admin/leads/:id
adminLeads.get('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  const data = await getAdminLeadById(c.req.param('id'))
  if (!data) return c.json({ error: 'Lead no encontrado' }, 404)
  return c.json({ data })
})

// PUT /api/v1/admin/leads/:id
adminLeads.put('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) {
    return c.json({ error: 'ID inválido' }, 400)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = leadUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  const data = await updateLeadStatus(c.req.param('id'), parsed.data)
  if (!data) return c.json({ error: 'Lead no encontrado' }, 404)
  return c.json({ data })
})

export default adminLeads
