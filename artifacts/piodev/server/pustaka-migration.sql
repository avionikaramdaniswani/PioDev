-- ═══════════════════════════════════════════════════════════════════════════════
-- Pustaka (Knowledge Base) Migration
-- ═══════════════════════════════════════════════════════════════════════════════
-- Idempotent: aman dijalankan berkali-kali.

-- ── 1. Table: documents ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  extracted_text TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  parse_status TEXT NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'processing', 'done', 'failed', 'skipped')),
  parse_error TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_user_id_idx ON public.documents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS documents_user_status_idx ON public.documents(user_id, parse_status);

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'Users view own documents'
  ) THEN
    CREATE POLICY "Users view own documents" ON public.documents
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'Users insert own documents'
  ) THEN
    CREATE POLICY "Users insert own documents" ON public.documents
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'Users update own documents'
  ) THEN
    CREATE POLICY "Users update own documents" ON public.documents
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'Users delete own documents'
  ) THEN
    CREATE POLICY "Users delete own documents" ON public.documents
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. Document monthly page usage (untuk billing tier limit halaman/bulan) ───
-- Cuma counts halaman yang DI-PARSE pakai Azure Document Intelligence.
-- File text-based (md, txt, kode) tidak masuk hitungan ini.
CREATE TABLE IF NOT EXISTS public.document_page_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- format YYYY-MM (WIB)
  pages_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month)
);

CREATE INDEX IF NOT EXISTS doc_page_usage_user_month_idx ON public.document_page_usage(user_id, month);

ALTER TABLE public.document_page_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_page_usage' AND policyname = 'Users view own page usage'
  ) THEN
    CREATE POLICY "Users view own page usage" ON public.document_page_usage
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. Storage bucket: pustaka ────────────────────────────────────────────────
-- Private bucket — file diakses lewat signed URL atau via service role di server.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pustaka',
  'pustaka',
  false,
  209715200, -- 200 MB hard cap (per-tier limit dicek di server)
  NULL -- semua mime allowed; per-tier filter di server
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit;

-- ── 5. Storage RLS: user cuma akses file dirinya ──────────────────────────────
-- Path convention: pustaka/{user_id}/{document_id}-{filename}

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Pustaka users read own'
  ) THEN
    CREATE POLICY "Pustaka users read own" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'pustaka' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Pustaka users insert own'
  ) THEN
    CREATE POLICY "Pustaka users insert own" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'pustaka' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Pustaka users delete own'
  ) THEN
    CREATE POLICY "Pustaka users delete own" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'pustaka' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
