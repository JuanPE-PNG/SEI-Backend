export type AdminRole = 'admin' | 'super_admin'
export type ProductStatus = 'available' | 'unavailable'
export type PriceModel = 'fixed' | 'range' | 'subscription' | 'quote'
export type CartStatus = 'active' | 'sent' | 'expired'
export type QuotationSource = 'whatsapp' | 'expired'
export type TagAppliesTo = 'software' | 'hardware' | 'both'
export type LeadStatus = 'new' | 'contacted' | 'closed'

export interface Database {
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string
          role: AdminRole
          is_active: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id: string
          role: AdminRole
          is_active?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          role?: AdminRole
          is_active?: boolean
        }
      }
      tags: {
        Row: {
          id: string
          name: string
          slug: string
          applies_to: TagAppliesTo
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          applies_to?: TagAppliesTo
          created_at?: string
        }
        Update: {
          name?: string
          slug?: string
          applies_to?: TagAppliesTo
        }
      }
      software: {
        Row: {
          id: string
          slug: string
          name: string
          tagline: string | null
          short_description: string | null
          overview: string | null
          technical_details: unknown
          api_integrations: unknown
          scalability_info: string | null
          security_info: string | null
          features: unknown
          tech_stack: unknown
          video_urls: unknown
          demo_url: string | null
          price_model: PriceModel
          price_min: number | null
          price_max: number | null
          status: ProductStatus
          is_featured: boolean
          sort_order: number
          view_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          tagline?: string | null
          short_description?: string | null
          overview?: string | null
          technical_details?: unknown
          api_integrations?: unknown
          scalability_info?: string | null
          security_info?: string | null
          features?: unknown
          tech_stack?: unknown
          video_urls?: unknown
          demo_url?: string | null
          price_model?: PriceModel
          price_min?: number | null
          price_max?: number | null
          status?: ProductStatus
          is_featured?: boolean
          sort_order?: number
          view_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          name?: string
          tagline?: string | null
          short_description?: string | null
          overview?: string | null
          technical_details?: unknown
          api_integrations?: unknown
          scalability_info?: string | null
          security_info?: string | null
          features?: unknown
          tech_stack?: unknown
          video_urls?: unknown
          demo_url?: string | null
          price_model?: PriceModel
          price_min?: number | null
          price_max?: number | null
          status?: ProductStatus
          is_featured?: boolean
          sort_order?: number
          updated_at?: string
        }
      }
      software_images: {
        Row: {
          id: string
          software_id: string
          storage_path: string
          alt_text: string | null
          is_thumbnail: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          software_id: string
          storage_path: string
          alt_text?: string | null
          is_thumbnail?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          alt_text?: string | null
          is_thumbnail?: boolean
          sort_order?: number
        }
      }
      software_tags: {
        Row: { software_id: string; tag_id: string }
        Insert: { software_id: string; tag_id: string }
        Update: Record<string, never>
      }
      hardware: {
        Row: {
          id: string
          slug: string
          name: string
          description: string | null
          brand: string | null
          specifications: unknown
          price_model: PriceModel
          price_min: number | null
          price_max: number | null
          status: ProductStatus
          is_featured: boolean
          sort_order: number
          view_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          description?: string | null
          brand?: string | null
          specifications?: unknown
          price_model?: PriceModel
          price_min?: number | null
          price_max?: number | null
          status?: ProductStatus
          is_featured?: boolean
          sort_order?: number
          view_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          name?: string
          description?: string | null
          brand?: string | null
          specifications?: unknown
          price_model?: PriceModel
          price_min?: number | null
          price_max?: number | null
          status?: ProductStatus
          is_featured?: boolean
          sort_order?: number
          updated_at?: string
        }
      }
      hardware_images: {
        Row: {
          id: string
          hardware_id: string
          storage_path: string
          alt_text: string | null
          is_thumbnail: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          hardware_id: string
          storage_path: string
          alt_text?: string | null
          is_thumbnail?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          alt_text?: string | null
          is_thumbnail?: boolean
          sort_order?: number
        }
      }
      hardware_tags: {
        Row: { hardware_id: string; tag_id: string }
        Insert: { hardware_id: string; tag_id: string }
        Update: Record<string, never>
      }
      carts: {
        Row: {
          id: string
          session_token: string
          status: CartStatus
          last_activity_at: string
          created_at: string
        }
        Insert: {
          id?: string
          session_token: string
          status?: CartStatus
          last_activity_at?: string
          created_at?: string
        }
        Update: {
          status?: CartStatus
          last_activity_at?: string
        }
      }
      cart_items: {
        Row: {
          id: string
          cart_id: string
          item_type: 'software' | 'hardware'
          item_id: string
          quantity: number
        }
        Insert: {
          id?: string
          cart_id: string
          item_type: 'software' | 'hardware'
          item_id: string
          quantity?: number
        }
        Update: {
          quantity?: number
        }
      }
      quotation_logs: {
        Row: {
          id: string
          items_snapshot: unknown
          source: QuotationSource
          created_at: string
        }
        Insert: {
          id?: string
          items_snapshot: unknown
          source: QuotationSource
          created_at?: string
        }
        Update: Record<string, never>
      }
      contact_leads: {
        Row: {
          id: string
          name: string
          email: string
          company: string | null
          service_type: string | null
          message: string
          status: LeadStatus
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          company?: string | null
          service_type?: string | null
          message: string
          status?: LeadStatus
          created_at?: string
        }
        Update: {
          status?: LeadStatus
        }
      }
      audit_log: {
        Row: {
          id: string
          action: string
          resource: string
          resource_id: string | null
          performed_by: string
          metadata: unknown
          created_at: string
        }
        Insert: {
          id?: string
          action: string
          resource: string
          resource_id?: string | null
          performed_by: string
          metadata?: unknown
          created_at?: string
        }
        Update: Record<string, never>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      admin_role: AdminRole
      product_status: ProductStatus
      price_model: PriceModel
      cart_status: CartStatus
      quotation_source: QuotationSource
      tag_applies_to: TagAppliesTo
      lead_status: LeadStatus
    }
  }
}
