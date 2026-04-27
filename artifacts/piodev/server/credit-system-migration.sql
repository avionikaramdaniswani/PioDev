-- ============================================================
-- PioCode — Credit System Migration
-- Jalankan di Supabase Dashboard → SQL Editor
--
-- Sistem saldo credit IDR (Plus only):
--  - Persistent balance, NO daily reset
--  - Bonus Rp 100.000 sekali saat upgrade ke Plus
--  - Top up beneran segera hadir
--  - Cost: 2 token = Rp 1, image Rp 1.000, video Rp 10.000
-- ============================================================

-- 1. Tambah kolom saldo credit ke profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS credit_balance_idr INTEGER NOT NULL DEFAULT 0;

-- 2. Tabel ledger transaksi credit (audit trail)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_idr INTEGER NOT NULL,           -- positive = tambah saldo, negative = kurang saldo
  type TEXT NOT NULL,                    -- bonus_plus_upgrade | top_up | usage_chat | usage_image | usage_video | admin_adjust
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS credit_tx_user_idx
  ON public.credit_transactions(user_id, created_at DESC);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own credit transactions" ON public.credit_transactions;
CREATE POLICY "Users view own credit transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);
