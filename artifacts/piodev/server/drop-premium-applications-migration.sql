-- ─────────────────────────────────────────────────────────────────────────────
-- DROP premium_applications
-- ─────────────────────────────────────────────────────────────────────────────
-- Fitur "Klaim Plus via Instagram" sudah berakhir.
-- Endpoint terkait sekarang return 410 Gone, dan tabel ini sudah tidak dipakai
-- oleh code manapun. Migrasi ini ngebersihin tabel + policy + bucket terkait.
--
-- Cara jalanin:
--   1. Buka Supabase Dashboard → SQL Editor
--   2. Paste isi file ini, klik Run
--   3. Idempotent — aman dijalanin berulang
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop RLS policies dulu (biar gak nyangkut kalau ada DROP POLICY error)
DROP POLICY IF EXISTS "Users can view own application"   ON public.premium_applications;
DROP POLICY IF EXISTS "Users can insert own application" ON public.premium_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.premium_applications;
DROP POLICY IF EXISTS "Admins can update applications"   ON public.premium_applications;

-- Drop tabel utama (CASCADE buat ngebuang FK / view yang masih nempel, kalau ada)
DROP TABLE IF EXISTS public.premium_applications CASCADE;

-- Selesai. Verifikasi:
--   SELECT to_regclass('public.premium_applications');  -- harus NULL
