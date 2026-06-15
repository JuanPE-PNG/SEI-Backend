import { env } from '../config/env.js'

export function getPublicUrl(bucket: string, storagePath: string): string {
  return `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`
}
