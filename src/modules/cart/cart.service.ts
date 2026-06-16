import { z } from 'zod'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { getPublicUrl } from '../../lib/storage.js'
import { hashToken } from '../../lib/hash.js'
import { env } from '../../config/env.js'

// ── Errors ────────────────────────────────────────────────────────────────────

export class CartNotFoundError extends Error {
  constructor() { super('Carrito no encontrado o expirado') }
}

export class CartEmptyError extends Error {
  constructor() { super('El carrito está vacío') }
}

// ── Schemas ───────────────────────────────────────────────────────────────────

export const addItemSchema = z.object({
  item_type: z.enum(['software', 'hardware']),
  item_id:   z.string().uuid(),
  quantity:  z.coerce.number().int().positive().max(99).default(1),
})

export type AddItemInput = z.infer<typeof addItemSchema>

// ── Internal helpers ──────────────────────────────────────────────────────────

async function touchCart(cartId: string): Promise<void> {
  await supabaseAdmin
    .from('carts')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', cartId)
}

function isExpired(lastActivityAt: string): boolean {
  const ms = Date.now() - new Date(lastActivityAt).getTime()
  return ms > env.CART_EXPIRY_HOURS * 3_600_000
}

async function expireAndLog(cartId: string): Promise<void> {
  const { data: items } = await supabaseAdmin
    .from('cart_items')
    .select('item_type, item_id, quantity')
    .eq('cart_id', cartId)

  if (items && items.length > 0) {
    await supabaseAdmin
      .from('quotation_logs')
      .insert({ items_snapshot: items, source: 'expired' })
  }

  await supabaseAdmin
    .from('carts')
    .update({ status: 'expired' })
    .eq('id', cartId)
}

async function resetCart(cartId: string): Promise<void> {
  await supabaseAdmin.from('cart_items').delete().eq('cart_id', cartId)
  await supabaseAdmin
    .from('carts')
    .update({ status: 'active', last_activity_at: new Date().toISOString() })
    .eq('id', cartId)
}

// ── Public service functions ──────────────────────────────────────────────────

export async function getOrCreateCart(rawToken: string) {
  const tokenHash = hashToken(rawToken)

  const { data: existing } = await supabaseAdmin
    .from('carts')
    .select('id, status, last_activity_at, created_at')
    .eq('session_token', tokenHash)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'active') {
      if (isExpired(existing.last_activity_at)) {
        await expireAndLog(existing.id)
        await resetCart(existing.id)
      }
      // Cart is valid — just return it
    } else {
      // Sent or expired: wipe and reactivate so the same token can be reused
      await resetCart(existing.id)
    }

    const { data: refreshed } = await supabaseAdmin
      .from('carts')
      .select('id, status, last_activity_at, created_at')
      .eq('id', existing.id)
      .single()

    return refreshed as { id: string; status: string; last_activity_at: string; created_at: string }
  }

  const { data, error } = await supabaseAdmin
    .from('carts')
    .insert({ session_token: tokenHash })
    .select('id, status, last_activity_at, created_at')
    .single()

  if (error) throw error
  return data as { id: string; status: string; last_activity_at: string; created_at: string }
}

export async function getCart(rawToken: string) {
  const tokenHash = hashToken(rawToken)

  const { data: cart } = await supabaseAdmin
    .from('carts')
    .select('id, status, last_activity_at, created_at')
    .eq('session_token', tokenHash)
    .eq('status', 'active')
    .maybeSingle()

  if (!cart) return null

  if (isExpired(cart.last_activity_at)) {
    await expireAndLog(cart.id)
    return null
  }

  const { data: rawItems } = await supabaseAdmin
    .from('cart_items')
    .select('id, item_type, item_id, quantity')
    .eq('cart_id', cart.id)

  const items = rawItems ?? []

  if (items.length === 0) {
    return { id: cart.id, status: cart.status, last_activity_at: cart.last_activity_at, created_at: cart.created_at, items: [] }
  }

  const softwareIds = items.filter((i: any) => i.item_type === 'software').map((i: any) => i.item_id)
  const hardwareIds = items.filter((i: any) => i.item_type === 'hardware').map((i: any) => i.item_id)

  const [swResult, hwResult] = await Promise.all([
    softwareIds.length > 0
      ? supabase.from('software').select('id, name, slug, price_model, price_min, price_max, software_images(storage_path, is_thumbnail)').in('id', softwareIds)
      : Promise.resolve({ data: [] as any[] }),
    hardwareIds.length > 0
      ? supabase.from('hardware').select('id, name, slug, price_model, price_min, price_max, hardware_images(storage_path, is_thumbnail)').in('id', hardwareIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const productMap = new Map<string, any>()

  for (const sw of swResult.data ?? []) {
    const thumb = (sw.software_images ?? []).find((img: any) => img.is_thumbnail)
    productMap.set(sw.id, {
      type:          'software',
      id:            sw.id,
      name:          sw.name,
      slug:          sw.slug,
      price_model:   sw.price_model,
      price_min:     sw.price_min,
      price_max:     sw.price_max,
      thumbnail_url: thumb ? getPublicUrl('software-images', thumb.storage_path) : null,
    })
  }

  for (const hw of hwResult.data ?? []) {
    const thumb = (hw.hardware_images ?? []).find((img: any) => img.is_thumbnail)
    productMap.set(hw.id, {
      type:          'hardware',
      id:            hw.id,
      name:          hw.name,
      slug:          hw.slug,
      price_model:   hw.price_model,
      price_min:     hw.price_min,
      price_max:     hw.price_max,
      thumbnail_url: thumb ? getPublicUrl('hardware-images', thumb.storage_path) : null,
    })
  }

  const populatedItems = items.map((item: any) => ({
    id:        item.id,
    item_type: item.item_type,
    item_id:   item.item_id,
    quantity:  item.quantity,
    product:   productMap.get(item.item_id) ?? null,
  }))

  return {
    id:               cart.id,
    status:           cart.status,
    last_activity_at: cart.last_activity_at,
    created_at:       cart.created_at,
    items:            populatedItems,
  }
}

export async function addCartItem(rawToken: string, input: AddItemInput) {
  const tokenHash = hashToken(rawToken)

  const { data: cart } = await supabaseAdmin
    .from('carts')
    .select('id, last_activity_at')
    .eq('session_token', tokenHash)
    .eq('status', 'active')
    .maybeSingle()

  if (!cart) throw new CartNotFoundError()
  if (isExpired(cart.last_activity_at)) {
    await expireAndLog(cart.id)
    throw new CartNotFoundError()
  }

  // Validate product exists and is available
  const table = input.item_type === 'software' ? 'software' : 'hardware'
  const { data: product } = await supabase
    .from(table)
    .select('id')
    .eq('id', input.item_id)
    .eq('status', 'available')
    .maybeSingle()

  if (!product) throw new Error('Producto no encontrado o no disponible')

  const { data: item, error } = await supabaseAdmin
    .from('cart_items')
    .upsert(
      { cart_id: cart.id, item_type: input.item_type, item_id: input.item_id, quantity: input.quantity },
      { onConflict: 'cart_id,item_type,item_id' }
    )
    .select('id, item_type, item_id, quantity')
    .single()

  if (error) throw error

  await touchCart(cart.id)
  return item
}

export async function removeCartItem(rawToken: string, itemId: string): Promise<void> {
  const tokenHash = hashToken(rawToken)

  const { data: cart } = await supabaseAdmin
    .from('carts')
    .select('id')
    .eq('session_token', tokenHash)
    .eq('status', 'active')
    .maybeSingle()

  if (!cart) throw new CartNotFoundError()

  await supabaseAdmin
    .from('cart_items')
    .delete()
    .eq('id', itemId)
    .eq('cart_id', cart.id)  // Garantiza que el ítem pertenece al carrito del token

  await touchCart(cart.id)
}

// ── WhatsApp checkout ─────────────────────────────────────────────────────────

function formatPrice(priceModel: string, priceMin: number | null, priceMax: number | null): string {
  const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

  switch (priceModel) {
    case 'fixed':
      return priceMin != null ? cop(priceMin) : 'Precio a convenir'
    case 'range':
      return priceMin != null && priceMax != null ? `${cop(priceMin)} – ${cop(priceMax)}` : 'Precio a convenir'
    case 'subscription':
      return priceMin != null ? `${cop(priceMin)}/mes` : 'Precio a convenir'
    default:
      return 'Precio a convenir'
  }
}

function buildWhatsAppMessage(items: any[]): string {
  const lines: string[] = ['Hola, me interesa cotizar lo siguiente:\n']

  const software = items.filter(i => i.item_type === 'software')
  const hardware = items.filter(i => i.item_type === 'hardware')

  if (software.length > 0) {
    lines.push('*Software:*')
    for (const item of software) {
      const p = item.product
      const price = p ? formatPrice(p.price_model, p.price_min, p.price_max) : 'Precio a convenir'
      lines.push(`• ${p?.name ?? item.item_id} (x${item.quantity}) — ${price}`)
    }
    lines.push('')
  }

  if (hardware.length > 0) {
    lines.push('*Hardware / Equipos:*')
    for (const item of hardware) {
      const p = item.product
      const price = p ? formatPrice(p.price_model, p.price_min, p.price_max) : 'Precio a convenir'
      lines.push(`• ${p?.name ?? item.item_id} (x${item.quantity}) — ${price}`)
    }
    lines.push('')
  }

  lines.push('¿Pueden darme más información?')
  return lines.join('\n')
}

export async function checkoutCart(rawToken: string): Promise<{ whatsapp_url: string }> {
  const cart = await getCart(rawToken)
  if (!cart) throw new CartNotFoundError()
  if (cart.items.length === 0) throw new CartEmptyError()

  const message = buildWhatsAppMessage(cart.items)

  const snapshot = cart.items.map((i: any) => ({
    item_type:    i.item_type,
    item_id:      i.item_id,
    quantity:     i.quantity,
    product_name: i.product?.name ?? null,
    price_model:  i.product?.price_model ?? null,
    price_min:    i.product?.price_min ?? null,
    price_max:    i.product?.price_max ?? null,
  }))

  await supabaseAdmin
    .from('quotation_logs')
    .insert({ items_snapshot: snapshot, source: 'whatsapp' })

  await supabaseAdmin
    .from('carts')
    .update({ status: 'sent' })
    .eq('id', cart.id)

  return {
    whatsapp_url: `https://wa.me/${env.WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`,
  }
}
