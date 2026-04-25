-- ============================================================
-- PioDev — API Keys Migration
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tabel api_keys (BYOK — user generate key untuk pakai PioDev API dari luar)
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  key_encrypted TEXT, -- AES-256-GCM ciphertext (base64). NULL = key lama, ga bisa di-reveal.
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Tambah kolom kalau tabel udah ada dari versi sebelumnya
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS key_encrypted TEXT;

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON public.api_keys(key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lihat api key sendiri" ON public.api_keys;
CREATE POLICY "Lihat api key sendiri" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Tabel api_daily_usage (kuota terpisah dari pemakaian web app)
CREATE TABLE IF NOT EXISTS public.api_daily_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  image_count INTEGER NOT NULL DEFAULT 0,
  video_count INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS api_daily_usage_date_idx ON public.api_daily_usage(date);

ALTER TABLE public.api_daily_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lihat usage api sendiri" ON public.api_daily_usage;
CREATE POLICY "Lihat usage api sendiri" ON public.api_daily_usage
  FOR SELECT USING (auth.uid() = user_id);
