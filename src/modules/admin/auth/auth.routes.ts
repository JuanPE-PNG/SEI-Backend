import { Hono } from 'hono'
import { z } from 'zod'
import { supabase, supabaseAdmin } from '../../../lib/supabase.js'
import { requireAuth } from '../../../middleware/auth.js'
import { authRateLimit } from '../../../middleware/rateLimit.js'

const auth = new Hono()

const loginSchema = z.object({
  email:    z.string().trim().email(),
  password: z.string().min(1),
})

// POST /api/v1/admin/auth/login
auth.post('/login', authRateLimit, async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
      400
    )
  }

  const { email, password } = parsed.data

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData.session) {
    return c.json({ error: 'Credenciales incorrectas.' }, 401)
  }

  // Verificar que el usuario existe y está activo en admin_users
  const { data: adminUser, error: dbError } = await supabaseAdmin
    .from('admin_users')
    .select('id, role, is_active')
    .eq('id', authData.user.id)
    .single()

  if (dbError || !adminUser) {
    return c.json({ error: 'Acceso denegado.' }, 403)
  }

  if (!(adminUser as any).is_active) {
    return c.json({ error: 'Cuenta desactivada.' }, 403)
  }

  return c.json({
    data: {
      access_token:  authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      token_type:    'bearer',
      expires_in:    authData.session.expires_in,
      user: {
        id:    authData.user.id,
        email: authData.user.email,
        role:  (adminUser as any).role,
      },
    },
  })
})

// GET /api/v1/admin/auth/me
auth.get('/me', requireAuth, async (c) => {
  const adminId = c.get('adminId')

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id, role, is_active, created_at')
    .eq('id', adminId)
    .single()

  if (error || !data) {
    return c.json({ error: 'Usuario no encontrado.' }, 404)
  }

  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(adminId)

  return c.json({
    data: {
      id:         (data as any).id,
      email:      user?.email ?? null,
      role:       (data as any).role,
      is_active:  (data as any).is_active,
      created_at: (data as any).created_at,
    },
  })
})

// POST /api/v1/admin/auth/logout
auth.post('/logout', requireAuth, async (c) => {
  const adminId = c.get('adminId')
  await supabaseAdmin.auth.admin.signOut(adminId)
  return c.json({ data: { logged_out: true } })
})

export default auth
