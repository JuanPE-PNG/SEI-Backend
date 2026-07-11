import { Hono } from 'hono'
import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase.js'
import { writeRateLimit } from '../../middleware/rateLimit.js'

const contact = new Hono()

const contactSchema = z.object({
  name:         z.string().trim().min(2).max(100),
  email:        z.string().trim().email().max(254),
  company:      z.string().trim().max(120).optional(),
  service_type: z.enum(['software', 'hardware', 'ambos', 'otro']).optional(),
  message:      z.string().trim().min(10).max(2000),
})

contact.post('/', writeRateLimit, async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = contactSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
      400
    )
  }

  const { name, email, company, service_type, message } = parsed.data

  const { data, error } = await supabaseAdmin
    .from('contact_leads')
    .insert({
      name,
      email,
      company:      company ?? null,
      service_type: service_type ?? null,
      message,
    })
    .select('id, name, email, company, service_type, message, status, created_at')
    .single()

  if (error) throw error

  return c.json({ data }, 201)
})

export default contact
