-- ─────────────────────────────────────────────────────────────────────────────
-- App Config Migration — key/value store untuk runtime config (harga, dll.)
-- Idempotent — aman dijalankan berkali-kali.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID
);

-- RLS: cuma admin yang boleh tulis. Read terbuka via service-role di backend.
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read app_config" ON public.app_config;
CREATE POLICY "Admin can read app_config" ON public.app_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin can write app_config" ON public.app_config;
CREATE POLICY "Admin can write app_config" ON public.app_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Default config row untuk pricing — kalau belum ada, insert default.
INSERT INTO public.app_config (key, value)
VALUES (
  'pricing',
  '{
    "plus": {"price_idr": 10000, "discount_percent": 0, "discount_label": ""},
    "pro":  {"price_idr": 18000, "discount_percent": 0, "discount_label": ""}
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
