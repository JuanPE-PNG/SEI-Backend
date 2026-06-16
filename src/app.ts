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
import cartRoutes             from './modules/cart/cart.routes.js'
import contactRoutes          from './modules/contact/contact.routes.js'
import adminAuthRoutes        from './modules/admin/auth/auth.routes.js'
import adminSoftwareRoutes    from './modules/admin/software/software.routes.js'
import adminHardwareRoutes    from './modules/admin/hardware/hardware.routes.js'

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
app.route('/v1/cart', cartRoutes)
app.route('/v1/contact', contactRoutes)
app.route('/v1/admin/auth', adminAuthRoutes)
app.route('/v1/admin/software', adminSoftwareRoutes)
app.route('/v1/admin/hardware', adminHardwareRoutes)

app.notFound((c) =>
  c.json({ error: `Ruta no encontrada: ${c.req.method} ${c.req.path}` }, 404)
)

app.onError(errorHandler)

export default app
