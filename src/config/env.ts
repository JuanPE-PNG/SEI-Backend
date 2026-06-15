import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  ALLOWED_ORIGINS: z.string().transform((s) =>
    s.split(',').map((o) => o.trim()).filter(Boolean)
  ),

  WHATSAPP_PHONE: z.string().min(7),

  CART_EXPIRY_HOURS: z.coerce.number().int().positive().default(72),

  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:')
  for (const [field, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
    console.error(`   ${field}: ${(issues as string[]).join(', ')}`)
  }
  process.exit(1)
}

// La guarda anterior garantiza que parsed.success es true aquí.
export const env = parsed.data!
export type Env = typeof env
