import { Hono } from 'hono'
import { softwareListSchema, listSoftware, getSoftwareBySlug, incrementViewCount } from './software.service.js'

const software = new Hono()

software.get('/', async (c) => {
  const raw = c.req.query()
  const parsed = softwareListSchema.safeParse(raw)

  if (!parsed.success) {
    return c.json(
      { error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors },
      400
    )
  }

  const result = await listSoftware(parsed.data)
  return c.json(result)
})

software.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const item = await getSoftwareBySlug(slug)

  if (!item) {
    return c.json({ error: 'Software no encontrado' }, 404)
  }

  // Fire-and-forget: no bloquea la respuesta
  incrementViewCount(item.id).catch(() => undefined)

  return c.json({ data: item })
})

export default software
