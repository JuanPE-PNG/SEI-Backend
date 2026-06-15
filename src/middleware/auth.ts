import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { supabase, supabaseAdmin } from '../lib/supabase.js'
import { logger } from '../lib/logger.js'
import type { AdminRole } from '../types/database.js'

declare module 'hono' {
  interface ContextVariableMap {
    adminId: string
    adminRole: AdminRole
  }
}

interface AdminUserRow {
  id: string
  role: AdminRole
  is_active: boolean
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Token de autorización requerido.' })
  }

  const token = authHeader.slice(7)

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    throw new HTTPException(401, { message: 'Token inválido o expirado.' })
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('admin_users')
    .select('id, role, is_active')
    .eq('id', user.id)
    .single()

  const adminUser = data as AdminUserRow | null

  if (dbError || !adminUser) {
    logger.warn('Intento de acceso admin sin registro en admin_users', { userId: user.id })
    throw new HTTPException(403, { message: 'Acceso denegado.' })
  }

  if (!adminUser.is_active) {
    throw new HTTPException(403, { message: 'Cuenta desactivada.' })
  }

  c.set('adminId', adminUser.id)
  c.set('adminRole', adminUser.role)
  return next()
}

export const requireSuperAdmin: MiddlewareHandler = async (c, next) => {
  if (c.get('adminRole') !== 'super_admin') {
    throw new HTTPException(403, { message: 'Se requiere rol super_admin.' })
  }
  return next()
}
