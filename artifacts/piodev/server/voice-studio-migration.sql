-- PioCode: Voice Studio Migration
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor
-- Idempotent — aman di-run berulang

-- ── 1. Tambah kolom voice_credits ke profiles (monthly reset, mirror pattern video_credits) ──
-- voice_credits MENYIMPAN JUMLAH TERPAKAI bulan ini, BUKAN sisa.
-- Sisa = max_credits (per tier) - voice_credits.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_credits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voice_credits_reset_date TEXT DEFAULT '';

-- Jika kolom sudah ada sebagai DATE (dari versi sebelumnya), convert ke TEXT
-- supaya bisa nyimpan format YYYY-MM (sama kayak video_credits_reset_date)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'voice_credits_reset_date'
      AND data_type = 'date'
  ) THEN
    ALTER TABLE public.profiles
      ALTER COLUMN voice_credits_reset_date TYPE TEXT USING TO_CHAR(voice_credits_reset_date, 'YYYY-MM');
    ALTER TABLE public.profiles
      ALTER COLUMN voice_credits_reset_date SET DEFAULT '';
  END IF;
END $$;

-- ── 2. Tabel user_voices — voice clone + voice design (persistent voice IDs) ──
-- Setiap user bisa simpan beberapa voice (cloned dari sample, atau didesain dari prompt).
-- voice_id = ID dari DashScope (qwen3-tts-vc / qwen-voice-design).
-- type = 'clone' | 'design' — supaya UI bisa beda-in source-nya.
CREATE TABLE IF NOT EXISTS public.user_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('clone', 'design')),
  dashscope_voice_id TEXT NOT NULL,
  source_text TEXT,                  -- prompt (untuk design) atau nama file (untuk clone)
  language TEXT DEFAULT 'id',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_voices_user ON public.user_voices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_voices_created ON public.user_voices(user_id, created_at DESC);

-- RLS
ALTER TABLE public.user_voices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own voices" ON public.user_voices;
CREATE POLICY "Users can view own voices" ON public.user_voices
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own voices" ON public.user_voices;
CREATE POLICY "Users can insert own voices" ON public.user_voices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own voices" ON public.user_voices;
CREATE POLICY "Users can delete own voices" ON public.user_voices
  FOR DELETE USING (auth.uid() = user_id);
