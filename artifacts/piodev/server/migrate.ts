import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runSql(sql: string, description: string) {
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!projectRef) throw new Error("Cannot extract project ref from URL");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`[${description}] HTTP ${res.status}:`, body);
    return false;
  }
  const data = await res.json();
  console.log(`[${description}] OK`, JSON.stringify(data).slice(0, 100));
  return true;
}

async function main() {
  console.log("== PioCode DB Migration ==");

  await runSql(`
    CREATE TABLE IF NOT EXISTS public.profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `, "CREATE TABLE profiles");

  await runSql(`
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  `, "ENABLE RLS");

  await runSql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile'
      ) THEN
        CREATE POLICY "Users can view own profile" ON public.profiles
          FOR SELECT USING (auth.uid() = id);
      END IF;
    END $$;
  `, "RLS policy select");

  await runSql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own non-role fields'
      ) THEN
        CREATE POLICY "Users can update own non-role fields" ON public.profiles
          FOR UPDATE USING (auth.uid() = id);
      END IF;
    END $$;
  `, "RLS policy update");

  await runSql(`
    INSERT INTO public.profiles (id, full_name, role)
    SELECT
      id,
      COALESCE(raw_user_meta_data->>'full_name', email),
      'user'
    FROM auth.users
    ON CONFLICT (id) DO NOTHING;
  `, "Seed existing users");

  await runSql(`
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.profiles (id, full_name, role)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'user'
      )
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `, "CREATE FUNCTION handle_new_user");

  await runSql(`
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  `, "CREATE TRIGGER");

  // ============================================================
  // Credit balance system (Plus only)
  // - credit_balance_idr: persistent saldo (no daily reset)
  // - credit_transactions: ledger untuk audit trail
  // ============================================================
  await runSql(`
    ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS credit_balance_idr INTEGER NOT NULL DEFAULT 0;
  `, "ADD COLUMN credit_balance_idr");

  await runSql(`
    CREATE TABLE IF NOT EXISTS public.credit_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      amount_idr INTEGER NOT NULL,
      type TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  `, "CREATE TABLE credit_transactions");

  await runSql(`
    CREATE INDEX IF NOT EXISTS credit_tx_user_idx
    ON public.credit_transactions(user_id, created_at DESC);
  `, "CREATE INDEX credit_tx_user_idx");

  await runSql(`
    ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
  `, "ENABLE RLS credit_transactions");

  await runSql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'credit_transactions'
          AND policyname = 'Users view own credit transactions'
      ) THEN
        CREATE POLICY "Users view own credit transactions" ON public.credit_transactions
          FOR SELECT USING (auth.uid() = user_id);
      END IF;
    END $$;
  `, "RLS policy credit_transactions select");

  console.log("== Migration complete ==");
}

main().catch(console.error);
