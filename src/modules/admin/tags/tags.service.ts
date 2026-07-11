import { z } from 'zod'
import { supabaseAdmin } from '../../../lib/supabase.js'

export const adminTagsListSchema = z.object({
  q:          z.string().trim().optional(),
  applies_to: z.enum(['software', 'hardware', 'both']).optional(),
})

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const tagBodySchema = z.object({
  name:       z.string().trim().min(1).max(100),
  slug:       z.string().trim().min(1).max(100).regex(slugRegex, 'Solo minúsculas, números y guiones'),
  applies_to: z.enum(['software', 'hardware', 'both']).default('both'),
})

export const tagUpdateSchema = tagBodySchema.partial()

export type TagBodyInput   = z.infer<typeof tagBodySchema>
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>

async function assertUnique(field: 'slug' | 'name', value: string, excludeId?: string): Promise<void> {
  let query = supabaseAdmin.from('tags').select('id').eq(field, value)
  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query.maybeSingle()
  if (data) throw new Error(`El ${field === 'slug' ? 'slug' : 'nombre'} "${value}" ya está en uso`)
}

export async function listAdminTags(query: z.infer<typeof adminTagsListSchema>) {
  const { q, applies_to } = query

  let dbQuery = supabaseAdmin
    .from('tags')
    .select('id, name, slug, applies_to, created_at')
    .order('name', { ascending: true })

  if (q) dbQuery = dbQuery.ilike('name', `%${q}%`)
  if (applies_to) dbQuery = dbQuery.eq('applies_to', applies_to)

  const { data, error } = await dbQuery
  if (error) throw error

  return { data: data ?? [] }
}

export async function getAdminTagById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('tags')
    .select('id, name, slug, applies_to, created_at')
    .eq('id', id)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error

  return data
}

export async function createTag(input: TagBodyInput) {
  await assertUnique('slug', input.slug)
  await assertUnique('name', input.name)

  const { data, error } = await supabaseAdmin
    .from('tags')
    .insert(input)
    .select('id, name, slug, applies_to, created_at')
    .single()

  if (error) throw error
  return data
}

export async function updateTag(id: string, input: TagUpdateInput) {
  if (input.slug) await assertUnique('slug', input.slug, id)
  if (input.name) await assertUnique('name', input.name, id)

  if (Object.keys(input).length === 0) return getAdminTagById(id)

  const { error } = await supabaseAdmin
    .from('tags')
    .update(input)
    .eq('id', id)

  if (error) throw error

  return getAdminTagById(id)
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('tags').delete().eq('id', id)
  if (error) throw error
}
