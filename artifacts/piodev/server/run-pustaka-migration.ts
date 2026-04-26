import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

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
  console.log(`[${description}] OK`);
  return true;
}

async function main() {
  console.log("== Pustaka Migration ==");
  const sql = readFileSync(join(__dirname, "pustaka-migration.sql"), "utf8");
  const ok = await runSql(sql, "Pustaka schema + bucket + RLS");
  if (!ok) {
    process.exit(1);
  }
  console.log("== Done ==");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
