import { Hono } from 'hono'
import { supabase } from '../../lib/supabase.js'

const health = new Hono()

health.get('/', async (c) => {
  // Ping a Supabase para verificar conectividad
  const start = Date.now()
  const { error } = await supabase.from('software').select('id').limit(1)
  const dbLatencyMs = Date.now() - start

  const status = error ? 'degraded' : 'ok'

  return c.json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: error ? 'unreachable' : `ok (${dbLatencyMs}ms)`,
    },
  }, status === 'ok' ? 200 : 503)
})

export default health
