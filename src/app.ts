import { Hono } from 'hono'
import { logger as honoLogger } from 'hono/logger'
import { corsMiddleware }     from './middleware/cors.js'
import { securityMiddleware } from './middleware/security.js'
import { errorHandler }       from './middleware/error.js'
import { publicRateLimit }    from './middleware/rateLimit.js'
import { logger }             from './lib/logger.js'
import healthRoutes           from './modules/health/health.routes.js'
import softwareRoutes         from './modules/software/software.routes.js'
import hardwareRoutes         from './modules/hardware/hardware.routes.js'
import tagsRoutes             from './modules/tags/tags.routes.js'

const app = new Hono().basePath('/api')

app.use('*', corsMiddleware)
app.use('*', securityMiddleware)
app.use('*', publicRateLimit)

app.use('*', honoLogger((message, ...rest) => {
  logger.info(message, { details: rest.join(' ') })
}))

app.route('/health', healthRoutes)
app.route('/v1/software', softwareRoutes)
app.route('/v1/hardware', hardwareRoutes)
app.route('/v1/tags', tagsRoutes)

app.notFound((c) =>
  c.json({ error: `Ruta no encontrada: ${c.req.method} ${c.req.path}` }, 404)
)

app.onError(errorHandler)

export default app
