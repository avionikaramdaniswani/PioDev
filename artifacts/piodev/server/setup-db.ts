import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("Setting up profiles table...");

  const { error: e1 } = await supabase.rpc("exec_sql" as any, {
    sql: `
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        full_name TEXT,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  });
  if (e1) console.log("Table creation note:", e1.message);

  const { data: users, error: e2 } = await supabase.auth.admin.listUsers();
  if (e2) { console.error("Cannot list users:", e2.message); process.exit(1); }

  console.log(`Found ${users.users.length} users — syncing profiles...`);

  for (const u of users.users) {
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: u.id,
        full_name: u.user_metadata?.full_name || u.email || "",
        role: "user",
      }, { onConflict: "id", ignoreDuplicates: true });
    if (error) console.log(`Skip ${u.email}:`, error.message);
    else console.log(`Synced: ${u.email}`);
  }

  console.log("Done!");
}

run().catch(console.error);
