-- =============================================================================
-- SEI Backend — Schema inicial
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =============================================================================

-- ── Extensiones ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- búsqueda de texto por similitud

-- ── Enums ─────────────────────────────────────────────────────────────────────
CREATE TYPE admin_role       AS ENUM ('admin', 'super_admin');
CREATE TYPE product_status   AS ENUM ('available', 'unavailable');
CREATE TYPE price_model      AS ENUM ('fixed', 'range', 'subscription', 'quote');
CREATE TYPE cart_status      AS ENUM ('active', 'sent', 'expired');
CREATE TYPE quotation_source AS ENUM ('whatsapp', 'expired');
CREATE TYPE tag_applies_to   AS ENUM ('software', 'hardware', 'both');
CREATE TYPE lead_status      AS ENUM ('new', 'contacted', 'closed');


-- ── Tabla: tags ───────────────────────────────────────────────────────────────
CREATE TABLE tags (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT         NOT NULL UNIQUE,
  slug        TEXT         NOT NULL UNIQUE,
  applies_to  tag_applies_to NOT NULL DEFAULT 'both',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ── Tabla: software ───────────────────────────────────────────────────────────
CREATE TABLE software (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT          NOT NULL UNIQUE,
  name                TEXT          NOT NULL,
  tagline             TEXT,
  short_description   TEXT,
  overview            TEXT,
  -- Arrays JSON: ["item1", "item2"]
  technical_details   JSONB         NOT NULL DEFAULT '[]',
  api_integrations    JSONB         NOT NULL DEFAULT '[]',
  features            JSONB         NOT NULL DEFAULT '[]',
  tech_stack          JSONB         NOT NULL DEFAULT '[]',
  -- Array de URLs de YouTube: ["url1", "url2"]
  video_urls          JSONB         NOT NULL DEFAULT '[]',
  scalability_info    TEXT,
  security_info       TEXT,
  demo_url            TEXT,
  price_model         price_model   NOT NULL DEFAULT 'quote',
  price_min           NUMERIC(12,2),
  price_max           NUMERIC(12,2),
  status              product_status NOT NULL DEFAULT 'available',
  is_featured         BOOLEAN       NOT NULL DEFAULT FALSE,
  sort_order          INTEGER       NOT NULL DEFAULT 0,
  view_count          INTEGER       NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ── Tabla: software_images ────────────────────────────────────────────────────
CREATE TABLE software_images (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id  UUID        NOT NULL REFERENCES software(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  alt_text     TEXT,
  is_thumbnail BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo puede haber un thumbnail por producto
CREATE UNIQUE INDEX idx_software_one_thumbnail
  ON software_images(software_id)
  WHERE is_thumbnail = TRUE;


-- ── Tabla: software_tags ──────────────────────────────────────────────────────
CREATE TABLE software_tags (
  software_id  UUID NOT NULL REFERENCES software(id) ON DELETE CASCADE,
  tag_id       UUID NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
  PRIMARY KEY (software_id, tag_id)
);


-- ── Tabla: hardware ───────────────────────────────────────────────────────────
-- Objeto JSON libre para specifications: { "procesador": "i7", "ram": "16GB", ... }
CREATE TABLE hardware (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT           NOT NULL UNIQUE,
  name           TEXT           NOT NULL,
  description    TEXT,
  brand          TEXT,
  specifications JSONB          NOT NULL DEFAULT '{}',
  price_model    price_model    NOT NULL DEFAULT 'quote',
  price_min      NUMERIC(12,2),
  price_max      NUMERIC(12,2),
  status         product_status NOT NULL DEFAULT 'available',
  is_featured    BOOLEAN        NOT NULL DEFAULT FALSE,
  sort_order     INTEGER        NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);


-- ── Tabla: hardware_images ────────────────────────────────────────────────────
CREATE TABLE hardware_images (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hardware_id  UUID        NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  alt_text     TEXT,
  is_thumbnail BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_hardware_one_thumbnail
  ON hardware_images(hardware_id)
  WHERE is_thumbnail = TRUE;


-- ── Tabla: hardware_tags ──────────────────────────────────────────────────────
CREATE TABLE hardware_tags (
  hardware_id  UUID NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
  tag_id       UUID NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
  PRIMARY KEY (hardware_id, tag_id)
);


-- ── Tabla: admin_users ────────────────────────────────────────────────────────
-- Vinculada a auth.users de Supabase. El usuario existe en Auth primero.
CREATE TABLE admin_users (
  id          UUID       PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        admin_role NOT NULL DEFAULT 'admin',
  is_active   BOOLEAN    NOT NULL DEFAULT TRUE,
  created_by  UUID       REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Tabla: carts ──────────────────────────────────────────────────────────────
CREATE TABLE carts (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Hash del token guardado en el navegador (nunca el token plano)
  session_token    TEXT         NOT NULL UNIQUE,
  status           cart_status  NOT NULL DEFAULT 'active',
  last_activity_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ── Tabla: cart_items ─────────────────────────────────────────────────────────
CREATE TABLE cart_items (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    UUID    NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  item_type  TEXT    NOT NULL CHECK (item_type IN ('software', 'hardware')),
  item_id    UUID    NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  -- Evitar duplicados del mismo producto en el mismo carrito
  UNIQUE (cart_id, item_type, item_id)
);


-- ── Tabla: quotation_logs ─────────────────────────────────────────────────────
-- Registro liviano e inmutable. No se modifica nunca.
CREATE TABLE quotation_logs (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  items_snapshot  JSONB             NOT NULL,
  source          quotation_source  NOT NULL,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);


-- ── Tabla: contact_leads ──────────────────────────────────────────────────────
CREATE TABLE contact_leads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  company      TEXT,
  service_type TEXT,
  message      TEXT        NOT NULL,
  status       lead_status NOT NULL DEFAULT 'new',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Tabla: audit_log ──────────────────────────────────────────────────────────
-- Inmutable. Solo INSERT, nunca UPDATE/DELETE.
CREATE TABLE audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action       TEXT        NOT NULL,  -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc.
  resource     TEXT        NOT NULL,  -- 'software', 'hardware', 'tag', 'user', etc.
  resource_id  UUID,
  performed_by UUID,                  -- NULL = acción del sistema
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Índices de performance ────────────────────────────────────────────────────
-- Software
CREATE INDEX idx_software_status      ON software(status);
CREATE INDEX idx_software_featured    ON software(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_software_sort        ON software(sort_order, created_at DESC);
CREATE INDEX idx_software_name_trgm   ON software USING GIN (name gin_trgm_ops);

-- Hardware
CREATE INDEX idx_hardware_status      ON hardware(status);
CREATE INDEX idx_hardware_featured    ON hardware(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_hardware_sort        ON hardware(sort_order, created_at DESC);
CREATE INDEX idx_hardware_name_trgm   ON hardware USING GIN (name gin_trgm_ops);

-- Tags
CREATE INDEX idx_tags_applies_to      ON tags(applies_to);

-- Carts
CREATE INDEX idx_carts_status         ON carts(status);
CREATE INDEX idx_carts_last_activity  ON carts(last_activity_at);

-- Leads
CREATE INDEX idx_leads_status         ON contact_leads(status);
CREATE INDEX idx_leads_created        ON contact_leads(created_at DESC);

-- Audit
CREATE INDEX idx_audit_resource       ON audit_log(resource, resource_id);
CREATE INDEX idx_audit_created        ON audit_log(created_at DESC);


-- ── Trigger: updated_at automático ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_software_updated_at
  BEFORE UPDATE ON software
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_hardware_updated_at
  BEFORE UPDATE ON hardware
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── Row Level Security ────────────────────────────────────────────────────────
-- Estrategia: todas las escrituras van por el backend con service role (bypasea RLS).
-- El anon key solo se usa para leer catálogo público.

ALTER TABLE software        ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_tags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware        ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_tags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_leads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;

-- Catálogo público: solo lectura de items disponibles
CREATE POLICY "anon_read_available"
  ON software FOR SELECT
  USING (status = 'available');

CREATE POLICY "anon_read"
  ON software_images FOR SELECT
  USING (true);

CREATE POLICY "anon_read"
  ON software_tags FOR SELECT
  USING (true);

CREATE POLICY "anon_read_available"
  ON hardware FOR SELECT
  USING (status = 'available');

CREATE POLICY "anon_read"
  ON hardware_images FOR SELECT
  USING (true);

CREATE POLICY "anon_read"
  ON hardware_tags FOR SELECT
  USING (true);

CREATE POLICY "anon_read"
  ON tags FOR SELECT
  USING (true);

-- Las demás tablas no tienen políticas públicas.
-- Solo el service role (supabaseAdmin) puede acceder a ellas.
-- admin_users, carts, cart_items, quotation_logs, contact_leads, audit_log
-- → accesibles únicamente desde el backend.
