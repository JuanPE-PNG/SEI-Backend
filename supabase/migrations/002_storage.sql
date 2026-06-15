-- =============================================================================
-- SEI Backend — Storage buckets y políticas
-- Ejecutar DESPUÉS de 001_initial_schema.sql
-- =============================================================================

-- ── Buckets ───────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES
  (
    'software-images',
    'software-images',
    true,                                          -- lectura pública sin auth
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/avif'],
    5242880                                        -- 5 MB máximo por archivo
  ),
  (
    'hardware-images',
    'hardware-images',
    true,
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/avif'],
    5242880
  )
ON CONFLICT (id) DO NOTHING;


-- ── Políticas de Storage ──────────────────────────────────────────────────────
-- Lectura pública (el bucket ya es public=true, pero RLS también debe permitirlo)
CREATE POLICY "public_read_software_images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'software-images');

CREATE POLICY "public_read_hardware_images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hardware-images');

-- Las subidas van exclusivamente por el backend usando service role (bypasea RLS).
-- No se crean políticas de INSERT/UPDATE/DELETE para usuarios anónimos o autenticados.
-- El backend valida MIME type y tamaño antes de generar la URL firmada.
