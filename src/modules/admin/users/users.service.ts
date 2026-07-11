import { z } from 'zod'
import { supabaseAdmin } from '../../../lib/supabase.js'

export const createAdminUserSchema = z.object({
  email:    z.string().trim().email(),
  password: z.string().min(8).max(72),
  role:     z.enum(['admin', 'super_admin']).default('admin'),
})

export const updateAdminUserSchema = z.object({
  role:      z.enum(['admin', 'super_admin']).optional(),
  is_active: z.boolean().optional(),
})

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>

interface AdminUserRow {
  id:         string
  role:       string
  is_active:  boolean
  created_by: string | null
  created_at: string
}

async function withEmail(row: AdminUserRow) {
  const { data } = await supabaseAdmin.auth.admin.getUserById(row.id)
  return {
    id:         row.id,
    email:      data.user?.email ?? null,
    role:       row.role,
    is_active:  row.is_active,
    created_by: row.created_by,
    created_at: row.created_at,
  }
}

export async function listAdminUsers() {
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id, role, is_active, created_by, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = (data ?? []) as AdminUserRow[]
  return { data: await Promise.all(rows.map(withEmail)) }
}

export async function getAdminUserById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id, role, is_active, created_by, created_at')
    .eq('id', id)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error

  return withEmail(data as AdminUserRow)
}

export async function createAdminUser(input: CreateAdminUserInput, createdBy: string) {
  const { email, password, role } = input

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) throw new Error(authError.message)

  const userId = authData.user.id

  const { error: dbError } = await supabaseAdmin
    .from('admin_users')
    .insert({ id: userId, role, is_active: true, created_by: createdBy })

  if (dbError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    throw new Error(dbError.message)
  }

  return getAdminUserById(userId)
}

export async function updateAdminUser(id: string, input: UpdateAdminUserInput) {
  if (Object.keys(input).length === 0) return getAdminUserById(id)

  const { error } = await supabaseAdmin
    .from('admin_users')
    .update(input)
    .eq('id', id)

  if (error) throw error

  return getAdminUserById(id)
}

export async function deleteAdminUser(id: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)
}
