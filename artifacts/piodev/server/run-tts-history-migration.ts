import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET_ID = "voice-studio-tts";
const BUCKET_FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10 MB
const BUCKET_ALLOWED_MIMES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
];

async function ensureBucket() {
  const { data: existing, error: getErr } =
    await supabaseAdmin.storage.getBucket(BUCKET_ID);
  if (existing && !getErr) {
    console.log(`[bucket] '${BUCKET_ID}' already exists — updating settings`);
    const { error: updErr } = await supabaseAdmin.storage.updateBucket(
      BUCKET_ID,
      {
        public: false,
        fileSizeLimit: BUCKET_FILE_SIZE_LIMIT,
        allowedMimeTypes: BUCKET_ALLOWED_MIMES,
      },
    );
    if (updErr) {
      console.error(`[bucket] update failed:`, updErr.message);
      return false;
    }
    return true;
  }
  console.log(`[bucket] creating '${BUCKET_ID}'`);
  const { error: createErr } = await supabaseAdmin.storage.createBucket(
    BUCKET_ID,
    {
      public: false,
      fileSizeLimit: BUCKET_FILE_SIZE_LIMIT,
      allowedMimeTypes: BUCKET_ALLOWED_MIMES,
    },
  );
  if (createErr) {
    console.error(`[bucket] create failed:`, createErr.message);
    return false;
  }
  console.log(`[bucket] created`);
  return true;
}

async function ensureTable() {
  const sql = readFileSync(
    join(__dirname, "tts-history-migration.sql"),
    "utf8",
  );
  // Coba pakai RPC exec_sql (kalau project pernah set up).
  const { error } = await supabaseAdmin.rpc("exec_sql" as any, { sql });
  if (error) {
    console.warn(
      `[sql] RPC exec_sql gagal: ${error.message}\n` +
        `Buka Supabase Dashboard → SQL Editor → New Query, lalu paste isi file:\n` +
        `  artifacts/piodev/server/tts-history-migration.sql\n` +
        `Lalu jalankan. Aman di-run berkali-kali (idempotent).`,
    );
    return false;
  }
  console.log(`[sql] table + RLS OK via exec_sql`);
  return true;
}

async function main() {
  console.log("== TTS History Migration ==");
  const bucketOk = await ensureBucket();
  const sqlOk = await ensureTable();
  if (!bucketOk) process.exit(1);
  if (!sqlOk) {
    console.log(
      "\nBucket sudah siap. Tabel tts_history MASIH harus dibuat manual lewat SQL editor (lihat instruksi di atas).",
    );
    process.exit(2);
  }
  console.log("== Done ==");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
