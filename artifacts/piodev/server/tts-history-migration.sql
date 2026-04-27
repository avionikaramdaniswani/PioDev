-- ═══════════════════════════════════════════════════════════════════════════════
-- Voice Studio: TTS History Migration
-- Idempotent: aman dijalankan berkali-kali.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Table: tts_history ─────────────────────────────────────────────────────
-- Nyimpen tiap hasil TTS user (baik preset maupun custom voice).
-- File audio mp3/wav disimpan di Storage bucket "voice-studio-tts" dengan path
-- `{user_id}/{id}.{ext}`. Kolom `storage_path` nyimpen path itu.
CREATE TABLE IF NOT EXISTS public.tts_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  voice_key TEXT NOT NULL,           -- ex: "preset:azure:id-ID-GadisNeural" atau "custom:<uuid>"
  voice_label TEXT,                  -- ex: "Gadis (Azure)" atau nama voice custom user (UI display)
  language TEXT NOT NULL DEFAULT 'Auto',
  model TEXT NOT NULL DEFAULT 'qwen3-tts-flash',
  instruction TEXT,                  -- prompt instruksi gaya (instruct model)
  storage_path TEXT NOT NULL,        -- path di bucket voice-studio-tts
  mime TEXT NOT NULL DEFAULT 'audio/mpeg',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tts_history_user_created_idx
  ON public.tts_history(user_id, created_at DESC);

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.tts_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tts_history' AND policyname = 'Users view own tts history'
  ) THEN
    CREATE POLICY "Users view own tts history" ON public.tts_history
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tts_history' AND policyname = 'Users insert own tts history'
  ) THEN
    CREATE POLICY "Users insert own tts history" ON public.tts_history
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tts_history' AND policyname = 'Users delete own tts history'
  ) THEN
    CREATE POLICY "Users delete own tts history" ON public.tts_history
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. Storage bucket: voice-studio-tts ───────────────────────────────────────
-- Private bucket; akses lewat signed URL (server-side) atau service role.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-studio-tts',
  'voice-studio-tts',
  false,
  10485760, -- 10 MB cap per file (TTS biasanya < 1 MB)
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 4. Storage RLS: user cuma akses file dirinya ──────────────────────────────
-- Path convention: voice-studio-tts/{user_id}/{tts_history_id}.{ext}

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'TTS users read own'
  ) THEN
    CREATE POLICY "TTS users read own" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'voice-studio-tts' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'TTS users insert own'
  ) THEN
    CREATE POLICY "TTS users insert own" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'voice-studio-tts' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'TTS users delete own'
  ) THEN
    CREATE POLICY "TTS users delete own" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'voice-studio-tts' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
