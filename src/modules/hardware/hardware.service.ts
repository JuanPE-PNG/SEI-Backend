import { z } from 'zod'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { getPublicUrl } from '../../lib/storage.js'

const BUCKET = 'hardware-images'

export const hardwareListSchema = z.object({
  q:        z.string().optional(),
  tags:     z.string().optional(),
  sort:     z.enum(['name_asc', 'name_desc', 'created_asc', 'created_desc', 'views', 'featured']).default('created_desc'),
  page:     z.coerce.number().int().positive().default(1),
  limit:    z.coerce.number().int().positive().max(100).default(20),
  featured: z.enum(['true', 'false']).optional(),
  brand:    z.string().optional(),
})

export type HardwareListParams = z.infer<typeof hardwareListSchema>

interface TagRow   { id: string; name: string; slug: string }
interface ImageRow { id: string; storage_path: string; alt_text: string | null; is_thumbnail: boolean; sort_order: number }

function mapImage(img: ImageRow) {
  return {
    id:           img.id,
    url:          getPublicUrl(BUCKET, img.storage_path),
    alt_text:     img.alt_text,
    is_thumbnail: img.is_thumbnail,
    sort_order:   img.sort_order,
  }
}

export async function listHardware(params: HardwareListParams) {
  const { q, tags, sort, page, limit, featured, brand } = params
  const from = (page - 1) * limit
  const to   = from + limit - 1

  let hardwareIdFilter: string[] | null = null
  if (tags) {
    const slugs = tags.split(',').map(s => s.trim()).filter(Boolean)
    if (slugs.length > 0) {
      const { data: tagRows } = await supabase
        .from('tags')
        .select('id')
        .in('slug', slugs)
        .in('applies_to', ['hardware', 'both'])

      const tagIds: string[] = (tagRows ?? []).map((t: { id: string }) => t.id)

      if (tagIds.length === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } }
      }

      const { data: linked } = await supabase
        .from('hardware_tags')
        .select('hardware_id')
        .in('tag_id', tagIds)

      hardwareIdFilter = [...new Set((linked ?? []).map((r: { hardware_id: string }) => r.hardware_id))]
      if (hardwareIdFilter.length === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } }
      }
    }
  }

  let query = supabase
    .from('hardware')
    .select(
      `id, slug, name, description, brand,
       price_model, price_min, price_max,
       is_featured, sort_order, view_count, created_at,
       hardware_images(id, storage_path, alt_text, is_thumbnail, sort_order),
       hardware_tags(tags(id, name, slug))`,
      { count: 'exact' }
    )
    .eq('status', 'available')

  if (q && q.trim()) {
    query = query.ilike('name', `%${q.trim()}%`)
  }
  if (hardwareIdFilter) {
    query = query.in('id', hardwareIdFilter)
  }
  if (featured === 'true') {
    query = query.eq('is_featured', true)
  }
  if (brand && brand.trim()) {
    query = query.ilike('brand', `%${brand.trim()}%`)
  }

  switch (sort) {
    case 'name_asc':    query = query.order('name',        { ascending: true });  break
    case 'name_desc':   query = query.order('name',        { ascending: false }); break
    case 'created_asc': query = query.order('created_at',  { ascending: true });  break
    case 'views':       query = query.order('view_count',  { ascending: false }); break
    case 'featured':    query = query.order('is_featured', { ascending: false }).order('sort_order', { ascending: true }); break
    default:            query = query.order('created_at',  { ascending: false }); break
  }

  query = query.range(from, to)

  const { data, count, error } = await query
  if (error) throw error

  const items = (data ?? [] as any[]).map((hw: any) => {
    const images: ImageRow[] = hw.hardware_images ?? []
    const stRows: any[]      = hw.hardware_tags ?? []
    const thumbnail = images.find((img: ImageRow) => img.is_thumbnail)
    const tags: TagRow[] = stRows.map((st: any) => st.tags).filter((t: unknown): t is TagRow => t !== null && t !== undefined)

    return {
      id:          hw.id,
      slug:        hw.slug,
      name:        hw.name,
      description: hw.description,
      brand:       hw.brand,
      price_model: hw.price_model,
      price_min:   hw.price_min,
      price_max:   hw.price_max,
      is_featured: hw.is_featured,
      view_count:  hw.view_count,
      created_at:  hw.created_at,
      thumbnail_url: thumbnail ? getPublicUrl(BUCKET, thumbnail.storage_path) : null,
      tags,
    }
  })

  const total = count ?? 0
  return {
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

export async function getHardwareBySlug(slug: string) {
  const { data, error } = await supabase
    .from('hardware')
    .select(
      `*,
       hardware_images(id, storage_path, alt_text, is_thumbnail, sort_order),
       hardware_tags(tags(id, name, slug))`
    )
    .eq('slug', slug)
    .eq('status', 'available')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  const images: ImageRow[] = (data.hardware_images ?? []).sort(
    (a: ImageRow, b: ImageRow) => a.sort_order - b.sort_order
  )
  const tags: TagRow[] = (data.hardware_tags ?? [])
    .map((st: any) => st.tags)
    .filter((t: unknown): t is TagRow => t !== null && t !== undefined)

  return {
    id:             data.id,
    slug:           data.slug,
    name:           data.name,
    description:    data.description,
    brand:          data.brand,
    specifications: data.specifications,
    price_model:    data.price_model,
    price_min:      data.price_min,
    price_max:      data.price_max,
    is_featured:    data.is_featured,
    view_count:     data.view_count,
    created_at:     data.created_at,
    updated_at:     data.updated_at,
    images:         images.map(mapImage),
    tags,
  }
}

export async function incrementViewCount(id: string): Promise<void> {
  await supabaseAdmin.rpc('increment_hardware_view', { p_id: id })
}
