-- ═══════════════════════════════════════════════════════════════════════════════
-- Tier System Migration — refactor binary is_premium → 3-tier (free/plus/pro)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Idempotent: aman dijalankan berkali-kali.
-- is_premium tetap dipakai (backward compat) — sekarang artinya tier IN ('plus','pro').

-- ── 1. profiles.tier ──────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free';

-- Constraint: tier wajib salah satu dari {free, plus, pro}
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tier_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_tier_check CHECK (tier IN ('free', 'plus', 'pro'));
  END IF;
END $$;

-- Backfill: user yang is_premium=true tapi tier masih 'free' → set ke 'plus'
UPDATE profiles
SET tier = 'plus'
WHERE is_premium = true AND tier = 'free';

-- Sebaliknya: kalau is_premium=false tapi tier!='free' (kasus aneh), normalisasi ke free
UPDATE profiles
SET tier = 'free'
WHERE (is_premium IS NULL OR is_premium = false) AND tier <> 'free';

CREATE INDEX IF NOT EXISTS profiles_tier_idx ON profiles(tier);

-- ── 2. premium_applications.tier ──────────────────────────────────────────────
-- Tier yang diminta user (untuk sekarang default 'plus' karena Pro belum buka).
ALTER TABLE premium_applications
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'plus';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'premium_applications_tier_check'
  ) THEN
    ALTER TABLE premium_applications
      ADD CONSTRAINT premium_applications_tier_check CHECK (tier IN ('plus', 'pro'));
  END IF;
END $$;
