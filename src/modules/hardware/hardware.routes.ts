import { Hono } from 'hono'
import { hardwareListSchema, listHardware, getHardwareBySlug, incrementViewCount } from './hardware.service.js'

const hardware = new Hono()

hardware.get('/', async (c) => {
  const raw = c.req.query()
  const parsed = hardwareListSchema.safeParse(raw)

  if (!parsed.success) {
    return c.json(
      { error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors },
      400
    )
  }

  const result = await listHardware(parsed.data)
  return c.json(result)
})

hardware.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const item = await getHardwareBySlug(slug)

  if (!item) {
    return c.json({ error: 'Producto no encontrado' }, 404)
  }

  // Fire-and-forget: no bloquea la respuesta
  incrementViewCount(item.id).catch(() => undefined)

  return c.json({ data: item })
})

export default hardware
