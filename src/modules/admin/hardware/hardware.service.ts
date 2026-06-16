import { z } from 'zod'
import { supabaseAdmin } from '../../../lib/supabase.js'

export const adminHardwareListSchema = z.object({
  q:      z.string().trim().optional(),
  status: z.enum(['available', 'unavailable']).optional(),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(100).default(20),
})

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const hardwareBodySchema = z.object({
  name:           z.string().trim().min(1).max(200),
  slug:           z.string().trim().min(1).max(200).regex(slugRegex, 'Solo minúsculas, números y guiones'),
  description:    z.string().trim().nullable().optional(),
  brand:          z.string().trim().max(120).nullable().optional(),
  specifications: z.unknown().optional(),
  price_model:    z.enum(['fixed', 'range', 'subscription', 'quote']).default('quote'),
  price_min:      z.number().positive().nullable().optional(),
  price_max:      z.number().positive().nullable().optional(),
  status:         z.enum(['available', 'unavailable']).default('available'),
  is_featured:    z.boolean().default(false),
  sort_order:     z.coerce.number().int().nonnegative().default(0),
  tag_ids:        z.array(z.string().uuid()).optional(),
})

export const hardwareUpdateSchema = hardwareBodySchema.partial()

export type HardwareBodyInput   = z.infer<typeof hardwareBodySchema>
export type HardwareUpdateInput = z.infer<typeof hardwareUpdateSchema>

async function assertSlugUnique(slug: string, excludeId?: string): Promise<void> {
  let query = supabaseAdmin.from('hardware').select('id').eq('slug', slug)
  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query.maybeSingle()
  if (data) throw new Error(`El slug "${slug}" ya está en uso`)
}

async function replaceTags(hardwareId: string, tagIds: string[]): Promise<void> {
  await supabaseAdmin.from('hardware_tags').delete().eq('hardware_id', hardwareId)
  if (tagIds.length > 0) {
    await supabaseAdmin.from('hardware_tags').insert(
      tagIds.map(tag_id => ({ hardware_id: hardwareId, tag_id }))
    )
  }
}

export async function listAdminHardware(query: z.infer<typeof adminHardwareListSchema>) {
  const { q, status, page, limit } = query
  const from = (page - 1) * limit
  const to   = from + limit - 1

  let dbQuery = supabaseAdmin
    .from('hardware')
    .select('id, name, slug, brand, status, is_featured, sort_order, price_model, price_min, price_max, view_count, created_at, updated_at', { count: 'exact' })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) dbQuery = dbQuery.ilike('name', `%${q}%`)
  if (status) dbQuery = dbQuery.eq('status', status)

  const { data, error, count } = await dbQuery
  if (error) throw error

  return {
    data:  data ?? [],
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  }
}

export async function getAdminHardwareById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('hardware')
    .select(`
      id, name, slug, description, brand, specifications,
      price_model, price_min, price_max, status, is_featured,
      sort_order, view_count, created_at, updated_at,
      hardware_images(id, storage_path, alt_text, is_thumbnail, sort_order),
      hardware_tags(tag_id, tags(id, name, slug, applies_to))
    `)
    .eq('id', id)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error

  return data as any
}

export async function createHardware(input: HardwareBodyInput) {
  const { tag_ids, ...fields } = input
  await assertSlugUnique(fields.slug)

  const { data, error } = await supabaseAdmin
    .from('hardware')
    .insert(fields as any)
    .select('id, name, slug, status, price_model, created_at')
    .single()

  if (error) throw error

  if (tag_ids && tag_ids.length > 0) {
    await replaceTags((data as any).id, tag_ids)
  }

  return data as any
}

export async function updateHardware(id: string, input: HardwareUpdateInput) {
  const { tag_ids, ...fields } = input

  if (fields.slug) await assertSlugUnique(fields.slug, id)

  if (Object.keys(fields).length > 0) {
    const { error } = await supabaseAdmin
      .from('hardware')
      .update({ ...fields as any, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  }

  if (tag_ids !== undefined) {
    await replaceTags(id, tag_ids)
  }

  return getAdminHardwareById(id)
}

export async function deleteHardware(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('hardware').delete().eq('id', id)
  if (error) throw error
}
