-- ─────────────────────────────────────────────────────────────────────────────
-- TRIAL SYSTEM (Plus 1-bulan, sekali per akun)
-- ─────────────────────────────────────────────────────────────────────────────
-- Nambah kolom `trial_claimed_at` di profiles untuk lacak apakah user udah pernah
-- klaim uji coba gratis. NULL = belum pernah klaim. Kalau sudah ada timestamp,
-- endpoint claim-trial akan return 409.
--
-- Cara jalanin:
--   1. Buka Supabase Dashboard → SQL Editor
--   2. Paste isi file ini, klik Run
--   3. Idempotent — aman dijalanin berulang
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_claimed_at TIMESTAMPTZ DEFAULT NULL;

-- Index opsional buat query "siapa aja yang pernah trial" (admin reporting nanti).
CREATE INDEX IF NOT EXISTS profiles_trial_claimed_at_idx
  ON public.profiles (trial_claimed_at)
  WHERE trial_claimed_at IS NOT NULL;

-- Verifikasi:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='profiles' AND column_name='trial_claimed_at';
