import { z } from 'zod'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { getPublicUrl } from '../../lib/storage.js'

const BUCKET = 'software-images'

export const softwareListSchema = z.object({
  q:        z.string().optional(),
  tags:     z.string().optional(),
  sort:     z.enum(['name_asc', 'name_desc', 'created_asc', 'created_desc', 'views', 'featured']).default('created_desc'),
  page:     z.coerce.number().int().positive().default(1),
  limit:    z.coerce.number().int().positive().max(100).default(20),
  featured: z.enum(['true', 'false']).optional(),
})

export type SoftwareListParams = z.infer<typeof softwareListSchema>

interface TagRow        { id: string; name: string; slug: string }
interface ImageRow      { id: string; storage_path: string; alt_text: string | null; is_thumbnail: boolean; sort_order: number }
interface SoftwareTagRow { tags: TagRow | null }

function mapImage(img: ImageRow) {
  return {
    id:           img.id,
    url:          getPublicUrl(BUCKET, img.storage_path),
    alt_text:     img.alt_text,
    is_thumbnail: img.is_thumbnail,
    sort_order:   img.sort_order,
  }
}

export async function listSoftware(params: SoftwareListParams) {
  const { q, tags, sort, page, limit, featured } = params
  const from = (page - 1) * limit
  const to   = from + limit - 1

  // Resolver slugs de tags -> IDs
  let softwareIdFilter: string[] | null = null
  if (tags) {
    const slugs = tags.split(',').map(s => s.trim()).filter(Boolean)
    if (slugs.length > 0) {
      const { data: tagRows } = await supabase
        .from('tags')
        .select('id')
        .in('slug', slugs)
        .in('applies_to', ['software', 'both'])

      const tagIds: string[] = (tagRows ?? []).map((t: { id: string }) => t.id)

      if (tagIds.length === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } }
      }

      const { data: linked } = await supabase
        .from('software_tags')
        .select('software_id')
        .in('tag_id', tagIds)

      softwareIdFilter = [...new Set((linked ?? []).map((r: { software_id: string }) => r.software_id))]
      if (softwareIdFilter.length === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } }
      }
    }
  }

  let query = supabase
    .from('software')
    .select(
      `id, slug, name, tagline, short_description,
       price_model, price_min, price_max,
       is_featured, sort_order, view_count, created_at,
       software_images(id, storage_path, alt_text, is_thumbnail, sort_order),
       software_tags(tags(id, name, slug))`,
      { count: 'exact' }
    )
    .eq('status', 'available')

  if (q && q.trim()) {
    query = query.ilike('name', `%${q.trim()}%`)
  }
  if (softwareIdFilter) {
    query = query.in('id', softwareIdFilter)
  }
  if (featured === 'true') {
    query = query.eq('is_featured', true)
  }

  switch (sort) {
    case 'name_asc':    query = query.order('name',       { ascending: true });  break
    case 'name_desc':   query = query.order('name',       { ascending: false }); break
    case 'created_asc': query = query.order('created_at', { ascending: true });  break
    case 'views':       query = query.order('view_count', { ascending: false }); break
    case 'featured':    query = query.order('is_featured', { ascending: false }).order('sort_order', { ascending: true }); break
    default:            query = query.order('created_at', { ascending: false }); break
  }

  query = query.range(from, to)

  const { data, count, error } = await query
  if (error) throw error

  const items = (data ?? [] as any[]).map((sw: any) => {
    const images: ImageRow[]  = sw.software_images ?? []
    const stRows: any[]       = sw.software_tags ?? []
    const thumbnail = images.find((img: ImageRow) => img.is_thumbnail)
    const tags: TagRow[] = stRows.map((st: any) => st.tags).filter((t: unknown): t is TagRow => t !== null && t !== undefined)

    return {
      id:                sw.id,
      slug:              sw.slug,
      name:              sw.name,
      tagline:           sw.tagline,
      short_description: sw.short_description,
      price_model:       sw.price_model,
      price_min:         sw.price_min,
      price_max:         sw.price_max,
      is_featured:       sw.is_featured,
      view_count:        sw.view_count,
      created_at:        sw.created_at,
      thumbnail_url:     thumbnail ? getPublicUrl(BUCKET, thumbnail.storage_path) : null,
      tags,
    }
  })

  const total = count ?? 0
  return {
    data:  items,
    meta:  { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

export async function getSoftwareBySlug(slug: string) {
  const { data, error } = await supabase
    .from('software')
    .select(
      `*,
       software_images(id, storage_path, alt_text, is_thumbnail, sort_order),
       software_tags(tags(id, name, slug))`
    )
    .eq('slug', slug)
    .eq('status', 'available')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  const images: ImageRow[] = (data.software_images ?? []).sort(
    (a: ImageRow, b: ImageRow) => a.sort_order - b.sort_order
  )
  const tags: TagRow[] = ((data.software_tags ?? []) as SoftwareTagRow[])
    .map(st => st.tags)
    .filter((t): t is TagRow => t !== null)

  return {
    id:                data.id,
    slug:              data.slug,
    name:              data.name,
    tagline:           data.tagline,
    short_description: data.short_description,
    overview:          data.overview,
    technical_details: data.technical_details,
    api_integrations:  data.api_integrations,
    features:          data.features,
    tech_stack:        data.tech_stack,
    video_urls:        data.video_urls,
    scalability_info:  data.scalability_info,
    security_info:     data.security_info,
    demo_url:          data.demo_url,
    price_model:       data.price_model,
    price_min:         data.price_min,
    price_max:         data.price_max,
    is_featured:       data.is_featured,
    view_count:        data.view_count,
    created_at:        data.created_at,
    updated_at:        data.updated_at,
    images:            images.map(mapImage),
    tags,
  }
}

export async function incrementViewCount(id: string): Promise<void> {
  await supabaseAdmin.rpc('increment_software_view', { p_id: id })
}
