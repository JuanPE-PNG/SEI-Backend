import { z } from 'zod'
import { supabaseAdmin } from '../../../lib/supabase.js'

export const adminLeadsListSchema = z.object({
  status: z.enum(['new', 'contacted', 'closed']).optional(),
  q:      z.string().trim().optional(),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(100).default(20),
})

export const leadUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'closed']),
})

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>

export async function listAdminLeads(query: z.infer<typeof adminLeadsListSchema>) {
  const { status, q, page, limit } = query
  const from = (page - 1) * limit
  const to   = from + limit - 1

  let dbQuery = supabaseAdmin
    .from('contact_leads')
    .select('id, name, email, company, service_type, message, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) dbQuery = dbQuery.eq('status', status)
  if (q) dbQuery = dbQuery.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)

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

export async function getAdminLeadById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('contact_leads')
    .select('id, name, email, company, service_type, message, status, created_at')
    .eq('id', id)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error

  return data
}

export async function updateLeadStatus(id: string, input: LeadUpdateInput) {
  const { error } = await supabaseAdmin
    .from('contact_leads')
    .update(input)
    .eq('id', id)

  if (error) throw error

  return getAdminLeadById(id)
}
