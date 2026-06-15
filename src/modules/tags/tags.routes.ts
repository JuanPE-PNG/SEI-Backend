import { Hono } from 'hono'
import { z } from 'zod'
import { supabase } from '../../lib/supabase.js'

const tags = new Hono()

const querySchema = z.object({
  applies_to: z.enum(['software', 'hardware', 'both']).optional(),
})

tags.get('/', async (c) => {
  const parsed = querySchema.safeParse(c.req.query())

  if (!parsed.success) {
    return c.json(
      { error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors },
      400
    )
  }

  const { applies_to } = parsed.data

  let query = supabase
    .from('tags')
    .select('id, name, slug, applies_to, created_at')
    .order('name', { ascending: true })

  // applies_to=hardware y applies_to=software
  // sin filtro        → todos
  if (applies_to && applies_to !== 'both') {
    query = query.in('applies_to', [applies_to, 'both'])
  }

  const { data, error } = await query
  if (error) throw error

  return c.json({ data: data ?? [] })
})

export default tags
