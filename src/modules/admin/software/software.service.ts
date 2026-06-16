import { z } from 'zod'
import { supabaseAdmin } from '../../../lib/supabase.js'

export const adminSoftwareListSchema = z.object({
  q:      z.string().trim().optional(),
  status: z.enum(['available', 'unavailable']).optional(),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(100).default(20),
})

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const softwareBodySchema = z.object({
  name:               z.string().trim().min(1).max(200),
  slug:               z.string().trim().min(1).max(200).regex(slugRegex, 'Solo minúsculas, números y guiones'),
  tagline:            z.string().trim().max(300).nullable().optional(),
  short_description:  z.string().trim().max(500).nullable().optional(),
  overview:           z.string().trim().nullable().optional(),
  technical_details:  z.unknown().optional(),
  api_integrations:   z.unknown().optional(),
  scalability_info:   z.string().trim().nullable().optional(),
  security_info:      z.string().trim().nullable().optional(),
  features:           z.unknown().optional(),
  tech_stack:         z.unknown().optional(),
  video_urls:         z.unknown().optional(),
  demo_url:           z.string().trim().url().nullable().optional(),
  price_model:        z.enum(['fixed', 'range', 'subscription', 'quote']).default('quote'),
  price_min:          z.number().positive().nullable().optional(),
  price_max:          z.number().positive().nullable().optional(),
  status:             z.enum(['available', 'unavailable']).default('available'),
  is_featured:        z.boolean().default(false),
  sort_order:         z.coerce.number().int().nonnegative().default(0),
  tag_ids:            z.array(z.string().uuid()).optional(),
})

export const softwareUpdateSchema = softwareBodySchema.partial()

export type SoftwareBodyInput  = z.infer<typeof softwareBodySchema>
export type SoftwareUpdateInput = z.infer<typeof softwareUpdateSchema>

async function assertSlugUnique(slug: string, excludeId?: string): Promise<void> {
  let query = supabaseAdmin.from('software').select('id').eq('slug', slug)
  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query.maybeSingle()
  if (data) throw new Error(`El slug "${slug}" ya está en uso`)
}

async function replaceTags(softwareId: string, tagIds: string[]): Promise<void> {
  await supabaseAdmin.from('software_tags').delete().eq('software_id', softwareId)
  if (tagIds.length > 0) {
    await supabaseAdmin.from('software_tags').insert(
      tagIds.map(tag_id => ({ software_id: softwareId, tag_id }))
    )
  }
}

export async function listAdminSoftware(query: z.infer<typeof adminSoftwareListSchema>) {
  const { q, status, page, limit } = query
  const from = (page - 1) * limit
  const to   = from + limit - 1

  let dbQuery = supabaseAdmin
    .from('software')
    .select('id, name, slug, status, is_featured, sort_order, price_model, price_min, price_max, view_count, created_at, updated_at', { count: 'exact' })
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

export async function getAdminSoftwareById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('software')
    .select(`
      id, name, slug, tagline, short_description, overview,
      technical_details, api_integrations, scalability_info, security_info,
      features, tech_stack, video_urls, demo_url,
      price_model, price_min, price_max, status, is_featured,
      sort_order, view_count, created_at, updated_at,
      software_images(id, storage_path, alt_text, is_thumbnail, sort_order),
      software_tags(tag_id, tags(id, name, slug, applies_to))
    `)
    .eq('id', id)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error

  return data as any
}

export async function createSoftware(input: SoftwareBodyInput) {
  const { tag_ids, ...fields } = input
  await assertSlugUnique(fields.slug)

  const { data, error } = await supabaseAdmin
    .from('software')
    .insert(fields as any)
    .select('id, name, slug, status, price_model, created_at')
    .single()

  if (error) throw error

  if (tag_ids && tag_ids.length > 0) {
    await replaceTags((data as any).id, tag_ids)
  }

  return data as any
}

export async function updateSoftware(id: string, input: SoftwareUpdateInput) {
  const { tag_ids, ...fields } = input

  if (fields.slug) await assertSlugUnique(fields.slug, id)

  if (Object.keys(fields).length > 0) {
    const { error } = await supabaseAdmin
      .from('software')
      .update({ ...fields as any, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  }

  if (tag_ids !== undefined) {
    await replaceTags(id, tag_ids)
  }

  return getAdminSoftwareById(id)
}

export async function deleteSoftware(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('software').delete().eq('id', id)
  if (error) throw error
}
