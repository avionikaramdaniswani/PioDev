import express from "express";
import { createClient } from "@supabase/supabase-js";
import net from "net";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SERVER_PORT = IS_PRODUCTION
  ? Number(process.env.PORT ?? 8080)
  : Number(process.env.SERVER_PORT ?? 3099);
const DAILY_TOKEN_LIMIT   = 60_000;
const PREMIUM_TOKEN_LIMIT = 360_000;
const FREE_VIDEO_CREDITS    = 3;
const PREMIUM_VIDEO_CREDITS = 12;
const FREE_IMAGE_LIMIT    = 7;
const PREMIUM_IMAGE_LIMIT = 25;

// ── Limit khusus akses lewat API key (terpisah dari pemakaian web) ─────────────
const API_DAILY_TOKEN_LIMIT = 200_000;
const API_DAILY_IMAGE_LIMIT = 50;
const API_DAILY_VIDEO_LIMIT = 10;
const API_DAILY_REQUEST_LIMIT = 1_000;

const DASHSCOPE_BASE = "https://dashscope-intl.aliyuncs.com";
const DASHSCOPE_COMPATIBLE_BASE = `${DASHSCOPE_BASE}/compatible-mode/v1`;

// Model-model yang hanya boleh dipakai user Plus/Admin
const PREMIUM_ONLY_MODELS = new Set([
  // PLUS_CHAIN
  "qwen3-max","qwen3-max-preview","qwen3-max-2026-01-23","qwen3-max-2025-09-23",
  "qwen3.5-397b-a17b","qwen3.5-122b-a10b",
  "qwen3-235b-a22b","qwen3-235b-a22b-instruct-2507","qwen3-235b-a22b-thinking-2507",
  "qwen3-next-80b-a3b-instruct","qwen3-next-80b-a3b-thinking",
  "qwq-plus","deepseek-v3.2",
  "qwen3.5-35b-a3b","qwen3.5-27b","qwen3.5-plus","qwen3.5-plus-2026-02-15",
  "qwen3-32b","qwen3-30b-a3b","qwen3-30b-a3b-instruct-2507","qwen3-30b-a3b-thinking-2507",
  "qwen3-14b","qwen2.5-72b-instruct","qwen-max","qwen-max-2025-01-25",
  // CODER_CHAIN
  "qwen3-coder-480b-a35b-instruct","qwen3-coder-next",
  "qwen3-coder-plus","qwen3-coder-plus-2025-09-23","qwen3-coder-plus-2025-07-22",
  "qwen3-coder-30b-a3b-instruct","qwen3-coder-flash","qwen3-coder-flash-2025-07-28",
]);

/** Tanggal hari ini dalam timezone WIB (UTC+7), format YYYY-MM-DD */
function getTodayWIB(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

/** Bulan saat ini dalam timezone WIB (UTC+7), format YYYY-MM */
function getThisMonthWIB(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 7);
}

/** Tanggal 1 bulan dari sekarang (ISO string) untuk premium_expires_at */
function oneMonthFromNow(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/** Cek apakah user aktif premium (is_premium=true dan belum expired) */
function isPremiumActive(profile: { is_premium?: boolean | null; premium_expires_at?: string | null }): boolean {
  if (!profile.is_premium) return false;
  if (!profile.premium_expires_at) return true; // record lama tanpa expiry = tetap aktif
  return new Date(profile.premium_expires_at) > new Date();
}

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const dashscopeApiKey = process.env.VITE_OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseAnonKey || !dashscopeApiKey) {
  console.error("[PioDev API] Missing required environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const app = express();
app.use(express.json());
app.use(express.raw({
  type: (req: any) => {
    const ct = (req.headers?.["content-type"] || "");
    return !ct.startsWith("application/json") && !ct.startsWith("multipart/");
  },
  limit: "50mb",
}));

async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = user.id;
  next();
}

async function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role !== "admin") {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }
  next();
}

// ── GET /api/me/role  (ambil role user sendiri) ──────────────────────────────
app.get("/api/me/role", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) {
    res.json({ role: "user" });
    return;
  }
  res.json({ role: data.role });
});

// ── GET /api/admin/users  (daftar semua user) ─────────────────────────────────
app.get("/api/admin/users", requireAuth, requireAdmin, async (_req, res) => {
  const { data: authUsers, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
  if (authErr) { res.status(500).json({ error: authErr.message }); return; }

  const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
  const profileMap: Record<string, any> = {};
  (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

  const users = authUsers.users.map((u) => ({
    id: u.id,
    email: u.email,
    full_name: profileMap[u.id]?.full_name || u.user_metadata?.full_name || "",
    role: profileMap[u.id]?.role || "user",
    is_premium: profileMap[u.id]?.is_premium ?? false,
    premium_expires_at: profileMap[u.id]?.premium_expires_at ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));

  res.json({ users });
});

// ── GET /api/admin/stats  (statistik singkat) ─────────────────────────────────
app.get("/api/admin/stats", requireAuth, requireAdmin, async (_req, res) => {
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  const totalUsers = authUsers?.users.length ?? 0;

  const { count: totalConversations } = await supabaseAdmin
    .from("conversations")
    .select("*", { count: "exact", head: true });

  const { count: totalMessages } = await supabaseAdmin
    .from("messages")
    .select("*", { count: "exact", head: true });

  const { data: tokenData } = await supabaseAdmin
    .from("daily_token_usage")
    .select("total_tokens");

  const totalTokens = (tokenData || []).reduce(
    (sum: number, row: any) => sum + (row.total_tokens || 0), 0
  );

  res.json({ totalUsers, totalConversations, totalMessages, totalTokens });
});

// ── PATCH /api/admin/users/:id/role  (ubah role user) ────────────────────────
app.patch("/api/admin/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  let body: any = {};
  try {
    const raw = req.body instanceof Buffer ? req.body.toString("utf8") : req.body;
    body = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch { /**/ }

  const { role } = body;
  if (!["user", "admin"].includes(role)) {
    res.status(400).json({ error: "Role harus 'user' atau 'admin'" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert({ id, role }, { onConflict: "id" });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

// ── DELETE /api/admin/users/:id  (hapus user) ─────────────────────────────────
app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

// ── GET /api/admin/users/:id/usage  (token usage per user) ────────────────────
app.get("/api/admin/users/:id/usage", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from("daily_token_usage")
    .select("*")
    .eq("user_id", id)
    .order("date", { ascending: false })
    .limit(30);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ usage: data || [] });
});

// ── GET /api/admin/daily-usage  (grafik token 7 hari) ─────────────────────────
app.get("/api/admin/daily-usage", async (_req, res, next) => {
  console.log("[daily-usage] INCOMING REQUEST — auth:", _req.headers.authorization?.slice(0,20));
  next();
}, requireAuth, requireAdmin, async (_req, res) => {
  // Ambil semua data tanpa filter tanggal di query (hindari masalah tipe kolom)
  const { data, error } = await supabaseAdmin
    .from("daily_token_usage")
    .select("date, total_tokens, messages")
    .order("date", { ascending: true });

  console.log("[daily-usage] rows:", data?.length ?? 0, "error:", error?.message ?? null);
  if (data && data.length > 0) console.log("[daily-usage] sample row:", JSON.stringify(data[0]));

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Hitung batas 7 hari terakhir di JS
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  cutoff.setHours(0, 0, 0, 0);

  const byDate: Record<string, { total_tokens: number; messages: number }> = {};

  (data || []).forEach((row: any) => {
    // date bisa berupa "2026-03-26" atau timestamp ISO
    const rawDate = String(row.date || "").slice(0, 10); // ambil YYYY-MM-DD saja
    if (!rawDate || rawDate.length < 10) return;
    const rowDate = new Date(rawDate + "T00:00:00");
    if (rowDate < cutoff) return; // lewati data lebih lama dari 7 hari
    if (!byDate[rawDate]) byDate[rawDate] = { total_tokens: 0, messages: 0 };
    byDate[rawDate].total_tokens += Number(row.total_tokens) || 0;
    byDate[rawDate].messages += Number(row.messages) || 0;
  });

  // Pastikan 7 slot hari selalu ada (isi 0 kalau tidak ada data) — berbasis WIB
  const slots: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() + 7 * 60 * 60 * 1000 - i * 24 * 60 * 60 * 1000);
    slots.push(d.toISOString().slice(0, 10));
  }

  const daily = slots.map((dateStr) => {
    const vals = byDate[dateStr] ?? { total_tokens: 0, messages: 0 };
    return {
      date: new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      token: vals.total_tokens,
      pesan: vals.messages,
    };
  });

  res.json({ daily });
});

// ── Changelog (What's New) ─────────────────────────────────────────────────────
app.get("/api/changelog", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("changelogs")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

app.post("/api/admin/changelog", requireAuth, requireAdmin, async (req, res) => {
  const { title, description, tag } = req.body as { title?: string; description?: string; tag?: string };
  if (!title?.trim() || !description?.trim()) {
    res.status(400).json({ error: "title dan description wajib diisi." }); return;
  }
  const validTags = ["new", "improvement", "fix", "removed"];
  const { data, error } = await supabaseAdmin
    .from("changelogs")
    .insert({ title: title.trim(), description: description.trim(), tag: validTags.includes(tag ?? "") ? tag : "new" })
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

app.delete("/api/admin/changelog/:id", requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin
    .from("changelogs")
    .delete()
    .eq("id", Number(req.params.id));
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// ── GET /api/me/quota  (sisa token hari ini) ───────────────────────────────────
app.get("/api/me/quota", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const today = getTodayWIB();
  const [usageRes, profileRes] = await Promise.all([
    supabaseAdmin.from("daily_token_usage").select("total_tokens").eq("user_id", userId).eq("date", today).single(),
    supabaseAdmin.from("profiles").select("is_premium, premium_expires_at, role").eq("id", userId).single(),
  ]);
  const used = usageRes.data?.total_tokens ?? 0;
  const isAdmin = profileRes.data?.role === "admin";
  const isPremium = isAdmin || isPremiumActive(profileRes.data ?? {});
  const limit = isAdmin ? 9_999_999 : isPremium ? PREMIUM_TOKEN_LIMIT : DAILY_TOKEN_LIMIT;
  res.json({ used, limit, remaining: Math.max(0, limit - used), isPremium });
});

// GET /api/me/usage-summary — ringkasan quota + status plus untuk halaman pengaturan
app.get("/api/me/usage-summary", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const today = getTodayWIB();
  const [usageRow, profileRow] = await Promise.all([
    supabaseAdmin.from("daily_token_usage").select("total_tokens").eq("user_id", userId).eq("date", today).single(),
    supabaseAdmin.from("profiles")
      .select("role, is_premium, premium_expires_at, video_credits, video_credits_reset_date, image_gen_count, image_gen_reset_date")
      .eq("id", userId).single(),
  ]);
  const profile = profileRow.data;
  const isAdmin = profile?.role === "admin";
  const isPremium = isAdmin || isPremiumActive(profile ?? {});

  const tokenUsed = usageRow.data?.total_tokens ?? 0;
  const tokenLimit = isAdmin ? 9_999_999 : isPremium ? PREMIUM_TOKEN_LIMIT : DAILY_TOKEN_LIMIT;

  // Image quota
  const imgDate = profile?.image_gen_reset_date ?? "";
  const imgCount = imgDate === today ? (profile?.image_gen_count ?? 0) : 0;
  const imgLimit = isAdmin ? 9999 : isPremium ? PREMIUM_IMAGE_LIMIT : FREE_IMAGE_LIMIT;

  // Video credits (monthly) — video_credits nyimpen TERPAKAI, bukan sisa
  const thisMonth = getThisMonthWIB();
  const storedMonth = (profile?.video_credits_reset_date ?? "").slice(0, 7);
  const videoMax = isAdmin ? 999 : isPremium ? PREMIUM_VIDEO_CREDITS : FREE_VIDEO_CREDITS;
  const videoUsed = storedMonth === thisMonth ? (profile?.video_credits ?? 0) : 0;
  const videoCredits = Math.max(0, videoMax - videoUsed);

  res.json({
    isPremium,
    isAdmin,
    premiumExpiresAt: profile?.premium_expires_at ?? null,
    token: { used: tokenUsed, limit: tokenLimit },
    image: { used: imgCount, limit: imgLimit },
    video: { credits: videoCredits, max: videoMax },
  });
});

app.get("/api/me/whats-new-last-seen", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("whats_new_last_seen")
    .eq("id", userId)
    .single();
  res.json({ lastSeen: data?.whats_new_last_seen ?? null });
});

app.put("/api/me/whats-new-last-seen", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("profiles")
    .update({ whats_new_last_seen: now })
    .eq("id", userId);
  res.json({ lastSeen: now });
});

// ── Video Credits API (reset BULANAN, tier-aware) ──────────────────────────────
// CATATAN: video_credits menyimpan jumlah TERPAKAI (bukan sisa) bulan ini.
// Sisa = maxCredits - video_credits.
async function getVideoCredits(userId: string): Promise<{ credits: number; maxCredits: number }> {
  const thisMonth = getThisMonthWIB();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("video_credits, video_credits_reset_date, role, is_premium, premium_expires_at")
    .eq("id", userId)
    .single();

  if (!profile) return { credits: 0, maxCredits: FREE_VIDEO_CREDITS };

  if (profile.role === "admin") return { credits: 999, maxCredits: 999 };

  const isPremium = isPremiumActive(profile);
  const maxCredits = isPremium ? PREMIUM_VIDEO_CREDITS : FREE_VIDEO_CREDITS;

  const storedMonth = (profile.video_credits_reset_date ?? "").slice(0, 7);
  if (storedMonth !== thisMonth) {
    // Bulan baru — reset used ke 0
    await supabaseAdmin
      .from("profiles")
      .update({ video_credits: 0, video_credits_reset_date: thisMonth })
      .eq("id", userId);
    return { credits: maxCredits, maxCredits };
  }

  const used = profile.video_credits ?? 0;
  return { credits: Math.max(0, maxCredits - used), maxCredits };
}

async function deductVideoCredit(userId: string): Promise<boolean> {
  const thisMonth = getThisMonthWIB();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, is_premium, premium_expires_at, video_credits, video_credits_reset_date")
    .eq("id", userId)
    .single();

  if (!profile) return false;
  if (profile.role === "admin") return true;

  const isPremium = isPremiumActive(profile);
  const maxCredits = isPremium ? PREMIUM_VIDEO_CREDITS : FREE_VIDEO_CREDITS;

  const storedMonth = (profile.video_credits_reset_date ?? "").slice(0, 7);
  const used = storedMonth === thisMonth ? (profile.video_credits ?? 0) : 0;

  if (used >= maxCredits) return false; // kredit habis

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ video_credits: used + 1, video_credits_reset_date: thisMonth })
    .eq("id", userId);

  if (error) return false;
  return true;
}

// ── Image Generation Quota API (reset HARIAN, tier-aware) ──────────────────────
async function getImageGenQuota(userId: string): Promise<{ count: number; limit: number; remaining: number }> {
  const today = getTodayWIB();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("image_gen_count, image_gen_reset_date, role, is_premium, premium_expires_at")
    .eq("id", userId)
    .single();

  if (!profile) return { count: 0, limit: FREE_IMAGE_LIMIT, remaining: FREE_IMAGE_LIMIT };
  if (profile.role === "admin") return { count: 0, limit: 9999, remaining: 9999 };

  const isPremium = isPremiumActive(profile);
  const limit = isPremium ? PREMIUM_IMAGE_LIMIT : FREE_IMAGE_LIMIT;

  if ((profile.image_gen_reset_date ?? "") !== today) {
    await supabaseAdmin
      .from("profiles")
      .update({ image_gen_count: 0, image_gen_reset_date: today })
      .eq("id", userId);
    return { count: 0, limit, remaining: limit };
  }

  const count = profile.image_gen_count ?? 0;
  return { count, limit, remaining: Math.max(0, limit - count) };
}

async function deductImageGen(userId: string): Promise<boolean> {
  const today = getTodayWIB();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, is_premium, premium_expires_at, image_gen_count, image_gen_reset_date")
    .eq("id", userId)
    .single();

  if (!profile) return false;
  if (profile.role === "admin") return true;

  const isPremium = isPremiumActive(profile);
  const limit = isPremium ? PREMIUM_IMAGE_LIMIT : FREE_IMAGE_LIMIT;

  let currentCount = profile.image_gen_count ?? 0;
  if ((profile.image_gen_reset_date ?? "") !== today) {
    currentCount = 0;
  }

  if (currentCount >= limit) return false;

  await supabaseAdmin
    .from("profiles")
    .update({ image_gen_count: currentCount + 1, image_gen_reset_date: today })
    .eq("id", userId);

  return true;
}

app.get("/api/video-credits", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const result = await getVideoCredits(userId);
  res.json(result);
});

app.post("/api/video-credits/deduct", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const ok = await deductVideoCredit(userId);
  if (!ok) {
    const quota = await getVideoCredits(userId);
    res.status(429).json({ error: `Kredit video bulan ini sudah habis (${quota.maxCredits} kredit). Coba lagi bulan depan!` });
    return;
  }
  const result = await getVideoCredits(userId);
  res.json(result);
});

// ── Image Gen Quota endpoints ───────────────────────────────────────────────────
app.get("/api/image-gen-quota", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const result = await getImageGenQuota(userId);
  res.json(result);
});

// ── Video Jobs API (Pio Studio) ────────────────────────────────────────────────
app.get("/api/video-jobs", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { data, error } = await supabaseAdmin
    .from("video_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

app.post("/api/video-jobs", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { task_id, prompt, model, mode, status, image_url } = req.body;
  const { data, error } = await supabaseAdmin
    .from("video_jobs")
    .insert({ user_id: userId, task_id, prompt, model, mode, status: status || "pending", image_url })
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

app.patch("/api/video-jobs/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const updates: Record<string, any> = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.video_url !== undefined) updates.video_url = req.body.video_url;
  if (req.body.error !== undefined) updates.error = req.body.error;
  const { data, error } = await supabaseAdmin
    .from("video_jobs")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

app.delete("/api/video-jobs/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("video_jobs").delete().eq("id", id).eq("user_id", userId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

app.delete("/api/video-jobs", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { error } = await supabaseAdmin.from("video_jobs").delete().eq("user_id", userId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// ── Premium Applications ───────────────────────────────────────────────────────

// GET /api/premium/status — cek status aplikasi premium user sendiri
app.get("/api/premium/status", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { data: profile } = await supabaseAdmin.from("profiles").select("is_premium, premium_expires_at, role").eq("id", userId).single();
  const { data: application } = await supabaseAdmin.from("premium_applications").select("*").eq("user_id", userId).maybeSingle();
  const isAdmin = profile?.role === "admin";
  res.json({
    isPremium: isAdmin || isPremiumActive(profile ?? {}),
    isAdmin,
    premiumExpiresAt: profile?.premium_expires_at ?? null,
    application: application ?? null,
  });
});

// POST /api/premium/upload-screenshots — upload via server (service role key)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.post("/api/premium/upload-screenshots", requireAuth, upload.fields([{ name: "ss1", maxCount: 1 }, { name: "ss2", maxCount: 1 }]), async (req, res) => {
  const userId = (req as any).userId;
  const files = req.files as Record<string, Express.Multer.File[]>;
  const ts = Date.now();
  const results: { url1: string; url2: string } = { url1: "", url2: "" };

  for (const [key, dest] of [["ss1", "url1"], ["ss2", "url2"]] as const) {
    const file = files?.[key]?.[0];
    if (!file) continue;
    const ext = (file.originalname.split(".").pop() ?? "jpg").toLowerCase();
    const fileName = `${userId}-${ts}-${key}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("premium-screenshots")
      .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });
    if (!error) {
      const { data } = supabaseAdmin.storage.from("premium-screenshots").getPublicUrl(fileName);
      results[dest] = data.publicUrl;
    }
  }

  res.json(results);
});

// POST /api/premium/apply — kirim aplikasi premium
app.post("/api/premium/apply", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  let body: any = {};
  try {
    const raw = req.body instanceof Buffer ? req.body.toString("utf8") : req.body;
    body = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch { /**/ }

  const instagram = (body.instagram || "").trim().replace(/^@/, "");
  const screenshot_url = (body.screenshot_url || "").trim();
  const screenshot_url_2 = (body.screenshot_url_2 || "").trim();
  if (!instagram) { res.status(400).json({ error: "Username Instagram wajib diisi." }); return; }

  // Cek apakah sudah punya aplikasi
  const [{ data: existing }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("premium_applications").select("id, status").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("profiles").select("is_premium, premium_expires_at").eq("id", userId).single(),
  ]);

  if (existing) {
    if (existing.status === "approved") {
      // Kalau Plus-nya masih aktif, tolak
      if (isPremiumActive(profile ?? {})) {
        res.status(400).json({ error: "Akunmu sudah premium!" }); return;
      }
      // Plus sudah expired → boleh ajukan ulang
    }
    if (existing.status === "pending") { res.status(400).json({ error: "Aplikasimu sedang dalam review." }); return; }
    // rejected atau expired approved → boleh apply ulang
    const { error } = await supabaseAdmin.from("premium_applications")
      .update({ instagram, screenshot_url, screenshot_url_2, status: "pending", reviewed_at: null })
      .eq("user_id", userId);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ ok: true, message: "Aplikasi berhasil dikirim ulang." });
    return;
  }

  const { error } = await supabaseAdmin.from("premium_applications").insert({ user_id: userId, instagram, screenshot_url, screenshot_url_2 });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true, message: "Aplikasi berhasil dikirim!" });
});

// GET /api/admin/premium-applications — daftar semua aplikasi (admin only)
app.get("/api/admin/premium-applications", requireAuth, requireAdmin, async (_req, res) => {
  const { data: apps, error } = await supabaseAdmin
    .from("premium_applications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }

  // Gabungkan dengan email user
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  const emailMap: Record<string, string> = {};
  (authUsers?.users || []).forEach((u) => { if (u.email) emailMap[u.id] = u.email; });

  const result = (apps || []).map((a: any) => ({ ...a, email: emailMap[a.user_id] ?? "" }));
  res.json({ applications: result });
});

// PATCH /api/admin/premium-applications/:id/approve
app.patch("/api/admin/premium-applications/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: app } = await supabaseAdmin.from("premium_applications").select("user_id").eq("id", id).single();
  if (!app) { res.status(404).json({ error: "Aplikasi tidak ditemukan." }); return; }

  const now = new Date().toISOString();

  await supabaseAdmin.from("premium_applications").update({ status: "approved", reviewed_at: now }).eq("id", id);
  // video_credits tidak perlu diubah — getVideoCredits hitung sisa otomatis dari used count
  await supabaseAdmin.from("profiles").update({
    is_premium: true,
    premium_expires_at: oneMonthFromNow(),
  }).eq("id", app.user_id);
  res.json({ ok: true });
});

// PATCH /api/admin/premium-applications/:id/reject
app.patch("/api/admin/premium-applications/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  let body: any = {};
  try {
    const raw = req.body instanceof Buffer ? req.body.toString("utf8") : req.body;
    body = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch { /**/ }
  const rejection_note = (body.note || "").trim();
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("premium_applications")
    .update({ status: "rejected", reviewed_at: now, rejection_note })
    .eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// PATCH /api/admin/users/:id/premium — toggle premium langsung dari tab pengguna
app.patch("/api/admin/users/:id/premium", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  let body: any = {};
  try {
    const raw = req.body instanceof Buffer ? req.body.toString("utf8") : req.body;
    body = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch { /**/ }
  const { is_premium, days } = body;

  let expiresAt: string | null = null;
  if (is_premium) {
    const d = new Date();
    if (typeof days === "number" && days > 0) {
      d.setDate(d.getDate() + days);
    } else {
      d.setMonth(d.getMonth() + 1); // default 1 bulan
    }
    expiresAt = d.toISOString();
  }

  // video_credits tidak perlu diubah saat toggle — getVideoCredits otomatis hitung sisa berdasar used count
  const updatePayload = { is_premium: !!is_premium, premium_expires_at: expiresAt };
  const { error } = await supabaseAdmin.from("profiles").update(updatePayload).eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── API KEYS (BYOK — Bring Your Own Key untuk akses PioDev API dari luar) ─────
// ═══════════════════════════════════════════════════════════════════════════════

const API_KEY_PREFIX = "pio-sk-";

function generateApiKey(): { full: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(36).toString("base64url");
  const full = `${API_KEY_PREFIX}${random}`;
  const hash = crypto.createHash("sha256").update(full).digest("hex");
  const prefix = `${API_KEY_PREFIX}${random.slice(0, 4)}...${random.slice(-4)}`;
  return { full, hash, prefix };
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

// ── Middleware: requireApiKey ────────────────────────────────────────────────
// Validasi API key + cek user premium aktif + cek limit harian khusus API.
// Setelah lolos, attach (req as any).apiUserId, .apiKeyId, .apiUsage
async function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      error: { message: "Missing or invalid Authorization header. Use: Authorization: Bearer pio-sk-...", type: "invalid_request_error" },
    });
    return;
  }
  const presented = authHeader.slice(7).trim();
  if (!presented.startsWith(API_KEY_PREFIX)) {
    res.status(401).json({
      error: { message: "Invalid API key format.", type: "invalid_request_error" },
    });
    return;
  }

  const keyHash = hashApiKey(presented);
  const { data: keyRow, error: keyErr } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", keyHash)
    .single();

  if (keyErr || !keyRow || keyRow.revoked_at) {
    res.status(401).json({
      error: { message: "Invalid or revoked API key.", type: "invalid_request_error" },
    });
    return;
  }

  const userId = keyRow.user_id;

  // Cek user premium aktif
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_premium, premium_expires_at, role")
    .eq("id", userId)
    .single();

  const isAdmin = profile?.role === "admin";
  const isPremium = isAdmin || isPremiumActive(profile ?? {});
  if (!isPremium) {
    res.status(403).json({
      error: { message: "API access requires an active Plus subscription.", type: "permission_denied" },
    });
    return;
  }

  // Update last_used_at (fire and forget)
  supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id).then(() => {});

  (req as any).apiUserId = userId;
  (req as any).apiKeyId = keyRow.id;
  (req as any).apiIsAdmin = isAdmin;
  next();
}

// Helpers untuk usage harian API
async function getApiUsage(userId: string) {
  const today = getTodayWIB();
  const { data } = await supabaseAdmin
    .from("api_daily_usage")
    .select("total_tokens, image_count, video_count, request_count")
    .eq("user_id", userId)
    .eq("date", today)
    .single();
  return data ?? { total_tokens: 0, image_count: 0, video_count: 0, request_count: 0 };
}

async function bumpApiUsage(userId: string, fields: { tokens?: number; images?: number; videos?: number; requests?: number }) {
  const today = getTodayWIB();
  const current = await getApiUsage(userId);
  await supabaseAdmin.from("api_daily_usage").upsert({
    user_id: userId,
    date: today,
    total_tokens: current.total_tokens + (fields.tokens ?? 0),
    image_count: current.image_count + (fields.images ?? 0),
    video_count: current.video_count + (fields.videos ?? 0),
    request_count: current.request_count + (fields.requests ?? 1),
  }, { onConflict: "user_id,date" });
}

// ── GET /api/me/api-keys — list semua key user (tanpa value asli) ────────────
app.get("/api/me/api-keys", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ keys: data ?? [] });
});

// ── POST /api/me/api-keys — buat key baru (cuma untuk user Plus/Admin) ───────
app.post("/api/me/api-keys", requireAuth, async (req, res) => {
  const userId = (req as any).userId;

  // Cek user premium
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_premium, premium_expires_at, role")
    .eq("id", userId)
    .single();
  const isAdmin = profile?.role === "admin";
  const isPremium = isAdmin || isPremiumActive(profile ?? {});
  if (!isPremium) {
    res.status(403).json({ error: "Fitur API key hanya untuk pengguna Plus." });
    return;
  }

  let body: any = {};
  try {
    const raw = req.body instanceof Buffer ? req.body.toString("utf8") : req.body;
    body = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch { /**/ }
  const name = (body?.name || "Untitled key").toString().slice(0, 80);

  // Maksimal 10 active key per user (biar ga abuse)
  const { count } = await supabaseAdmin
    .from("api_keys")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if ((count ?? 0) >= 10) {
    res.status(400).json({ error: "Maksimal 10 active API key. Hapus dulu yang ga dipakai." });
    return;
  }

  const { full, hash, prefix } = generateApiKey();
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert({ user_id: userId, name, key_hash: hash, key_prefix: prefix })
    .select("id, name, key_prefix, created_at")
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  // Kirim full key SEKALI aja — user wajib copy sekarang
  res.json({ ...data, key: full, warning: "Simpan key ini sekarang. Kamu ga akan bisa lihat lagi." });
});

// ── DELETE /api/me/api-keys/:id — revoke key ─────────────────────────────────
app.delete("/api/me/api-keys/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const { error } = await supabaseAdmin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

// ── GET /api/me/api-usage — pemakaian API hari ini + limit ───────────────────
app.get("/api/me/api-usage", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const usage = await getApiUsage(userId);
  res.json({
    usage,
    limits: {
      tokens: API_DAILY_TOKEN_LIMIT,
      images: API_DAILY_IMAGE_LIMIT,
      videos: API_DAILY_VIDEO_LIMIT,
      requests: API_DAILY_REQUEST_LIMIT,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── PUBLIC API (OpenAI-compatible) — diakses pakai pio-sk-... ────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// CORS untuk akses dari aplikasi luar
app.use("/v1", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  next();
});

// Helper: parse JSON body (bisa Buffer atau object)
function parseBody(req: express.Request): any {
  if (req.body instanceof Buffer) {
    try { return JSON.parse(req.body.toString("utf8")); } catch { return {}; }
  }
  return typeof req.body === "object" && req.body !== null ? req.body : {};
}

// Helper: extract token usage dari response chat (untuk billing)
function extractTokensFromResponse(json: any): number {
  return json?.usage?.total_tokens ?? 0;
}

// ── GET /v1/models — list model yang available ───────────────────────────────
app.get("/v1/models", requireApiKey, async (_req, res) => {
  // Forward dari dashscope compatible-mode
  try {
    const upstream = await fetch(`${DASHSCOPE_COMPATIBLE_BASE}/models`, {
      headers: { Authorization: `Bearer ${dashscopeApiKey}` },
    });
    const text = await upstream.text();
    res.status(upstream.status).type("application/json").send(text);
  } catch {
    res.status(502).json({ error: { message: "Upstream error", type: "api_error" } });
  }
});

// ── POST /v1/chat/completions — chat (streaming + non-streaming) ─────────────
app.post("/v1/chat/completions", requireApiKey, async (req, res) => {
  const userId = (req as any).apiUserId;
  const isAdmin = (req as any).apiIsAdmin;

  const usage = await getApiUsage(userId);
  if (!isAdmin && usage.total_tokens >= API_DAILY_TOKEN_LIMIT) {
    res.status(429).json({ error: { message: `Daily token limit reached (${API_DAILY_TOKEN_LIMIT.toLocaleString()}). Try again tomorrow.`, type: "rate_limit_error" } });
    return;
  }
  if (!isAdmin && usage.request_count >= API_DAILY_REQUEST_LIMIT) {
    res.status(429).json({ error: { message: `Daily request limit reached (${API_DAILY_REQUEST_LIMIT}).`, type: "rate_limit_error" } });
    return;
  }

  const body = parseBody(req);
  const isStream = !!body.stream;

  let upstream: Response;
  try {
    upstream = await fetch(`${DASHSCOPE_COMPATIBLE_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dashscopeApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    res.status(502).json({ error: { message: "Upstream error", type: "api_error" } });
    return;
  }

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    const skip = ["transfer-encoding", "connection", "keep-alive", "content-encoding", "content-length"];
    if (!skip.includes(key.toLowerCase())) res.setHeader(key, value);
  });

  if (!upstream.body) { res.end(); return; }

  if (isStream) {
    // Streaming: pipe + parse SSE untuk extract usage di akhir
    const reader = upstream.body.getReader();
    let buffered = "";
    let totalTokens = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        res.write(chunk);
        buffered += chunk.toString("utf8");
        // Cari frame dengan "usage" (biasanya di chunk terakhir kalau stream_options.include_usage=true)
        const matches = buffered.match(/"total_tokens"\s*:\s*(\d+)/g);
        if (matches && matches.length > 0) {
          const last = matches[matches.length - 1];
          const m = last.match(/(\d+)/);
          if (m) totalTokens = Math.max(totalTokens, parseInt(m[1], 10));
        }
      }
    } catch { /**/ }
    res.end();
    bumpApiUsage(userId, { tokens: totalTokens, requests: 1 }).catch(() => {});
  } else {
    const text = await upstream.text();
    res.send(text);
    let tokens = 0;
    try { tokens = extractTokensFromResponse(JSON.parse(text)); } catch { /**/ }
    bumpApiUsage(userId, { tokens, requests: 1 }).catch(() => {});
  }
});

// ── POST /v1/embeddings — embeddings ─────────────────────────────────────────
app.post("/v1/embeddings", requireApiKey, async (req, res) => {
  const userId = (req as any).apiUserId;
  const usage = await getApiUsage(userId);
  if (usage.request_count >= API_DAILY_REQUEST_LIMIT) {
    res.status(429).json({ error: { message: "Daily request limit reached.", type: "rate_limit_error" } });
    return;
  }
  try {
    const upstream = await fetch(`${DASHSCOPE_COMPATIBLE_BASE}/embeddings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${dashscopeApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(parseBody(req)),
    });
    const text = await upstream.text();
    res.status(upstream.status).type("application/json").send(text);
    let tokens = 0;
    try { tokens = extractTokensFromResponse(JSON.parse(text)); } catch { /**/ }
    bumpApiUsage(userId, { tokens, requests: 1 }).catch(() => {});
  } catch {
    res.status(502).json({ error: { message: "Upstream error", type: "api_error" } });
  }
});

// ── POST /v1/images/generations — image generation (OpenAI-compatible) ───────
// Map ke dashscope text2image-synthesis
app.post("/v1/images/generations", requireApiKey, async (req, res) => {
  const userId = (req as any).apiUserId;
  const isAdmin = (req as any).apiIsAdmin;

  const usage = await getApiUsage(userId);
  if (!isAdmin && usage.image_count >= API_DAILY_IMAGE_LIMIT) {
    res.status(429).json({ error: { message: `Daily image limit reached (${API_DAILY_IMAGE_LIMIT}).`, type: "rate_limit_error" } });
    return;
  }

  const body = parseBody(req);
  const prompt = body.prompt;
  if (!prompt) {
    res.status(400).json({ error: { message: "prompt is required", type: "invalid_request_error" } });
    return;
  }
  const model = body.model || "wan2.2-t2i-flash";
  const n = Math.min(Math.max(body.n ?? 1, 1), 4);
  const size = body.size || "1024*1024";

  // Step 1: submit task
  let createResp: Response;
  try {
    createResp = await fetch(`${DASHSCOPE_BASE}/api/v1/services/aigc/text2image/image-synthesis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dashscopeApiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model,
        input: { prompt },
        parameters: { n, size: size.replace("x", "*") },
      }),
    });
  } catch {
    res.status(502).json({ error: { message: "Upstream error", type: "api_error" } });
    return;
  }

  const createJson: any = await createResp.json().catch(() => ({}));
  const taskId = createJson?.output?.task_id;
  if (!taskId) {
    res.status(createResp.status).json({ error: { message: createJson?.message || "Failed to submit task", type: "api_error", upstream: createJson } });
    return;
  }

  // Step 2: poll until done (max 90s)
  const start = Date.now();
  let result: any = null;
  while (Date.now() - start < 90_000) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollResp = await fetch(`${DASHSCOPE_BASE}/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${dashscopeApiKey}` },
    });
    const pollJson: any = await pollResp.json().catch(() => ({}));
    const status = pollJson?.output?.task_status;
    if (status === "SUCCEEDED") { result = pollJson; break; }
    if (status === "FAILED" || status === "CANCELED" || status === "UNKNOWN") {
      res.status(500).json({ error: { message: pollJson?.output?.message || "Task failed", type: "api_error" } });
      return;
    }
  }

  if (!result) {
    res.status(504).json({ error: { message: "Image generation timed out", type: "api_error" } });
    return;
  }

  const results = result?.output?.results ?? [];
  const data = results.map((r: any) => ({ url: r.url }));

  res.json({
    created: Math.floor(Date.now() / 1000),
    data,
  });
  bumpApiUsage(userId, { images: data.length, requests: 1 }).catch(() => {});
});

// ── POST /v1/videos/generations — video generation ───────────────────────────
app.post("/v1/videos/generations", requireApiKey, async (req, res) => {
  const userId = (req as any).apiUserId;
  const isAdmin = (req as any).apiIsAdmin;

  const usage = await getApiUsage(userId);
  if (!isAdmin && usage.video_count >= API_DAILY_VIDEO_LIMIT) {
    res.status(429).json({ error: { message: `Daily video limit reached (${API_DAILY_VIDEO_LIMIT}).`, type: "rate_limit_error" } });
    return;
  }

  const body = parseBody(req);
  const prompt = body.prompt;
  if (!prompt) {
    res.status(400).json({ error: { message: "prompt is required", type: "invalid_request_error" } });
    return;
  }
  const model = body.model || "wan2.2-t2v-plus";
  const size = body.size || "1280*720";

  // Step 1: submit
  let createResp: Response;
  try {
    createResp = await fetch(`${DASHSCOPE_BASE}/api/v1/services/aigc/video-generation/video-synthesis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dashscopeApiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model,
        input: { prompt },
        parameters: { size: size.replace("x", "*") },
      }),
    });
  } catch {
    res.status(502).json({ error: { message: "Upstream error", type: "api_error" } });
    return;
  }

  const createJson: any = await createResp.json().catch(() => ({}));
  const taskId = createJson?.output?.task_id;
  if (!taskId) {
    res.status(createResp.status).json({ error: { message: createJson?.message || "Failed to submit task", type: "api_error", upstream: createJson } });
    return;
  }

  // Untuk video, return task_id supaya user bisa poll sendiri (video bisa lama 5+ menit)
  res.json({
    created: Math.floor(Date.now() / 1000),
    task_id: taskId,
    status: "PENDING",
    message: "Video sedang di-generate. Poll GET /v1/videos/generations/{task_id} untuk cek status.",
  });
  bumpApiUsage(userId, { videos: 1, requests: 1 }).catch(() => {});
});

// ── GET /v1/videos/generations/:taskId — poll status video ───────────────────
app.get("/v1/videos/generations/:taskId", requireApiKey, async (req, res) => {
  const { taskId } = req.params;
  try {
    const pollResp = await fetch(`${DASHSCOPE_BASE}/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${dashscopeApiKey}` },
    });
    const pollJson: any = await pollResp.json().catch(() => ({}));
    const status = pollJson?.output?.task_status;
    const videoUrl = pollJson?.output?.video_url ?? pollJson?.output?.results?.[0]?.url ?? null;
    res.json({
      task_id: taskId,
      status: status || "UNKNOWN",
      video_url: videoUrl,
      raw: pollJson?.output ?? null,
    });
  } catch {
    res.status(502).json({ error: { message: "Upstream error", type: "api_error" } });
  }
});

// ── POST /v1/ocr — OCR (pakai qwen-vl, format mirip OpenAI vision) ───────────
// Body: { image: "url-atau-base64-data:image/png;base64,...", prompt?: "..." }
app.post("/v1/ocr", requireApiKey, async (req, res) => {
  const userId = (req as any).apiUserId;
  const usage = await getApiUsage(userId);
  if (usage.total_tokens >= API_DAILY_TOKEN_LIMIT) {
    res.status(429).json({ error: { message: "Daily token limit reached.", type: "rate_limit_error" } });
    return;
  }

  const body = parseBody(req);
  const image = body.image;
  const promptText = body.prompt || "Read all text in this image accurately. Return only the text, preserving the original layout where possible.";
  if (!image) {
    res.status(400).json({ error: { message: "image (url or data:base64) is required", type: "invalid_request_error" } });
    return;
  }
  const model = body.model || "qwen-vl-ocr";

  try {
    const upstream = await fetch(`${DASHSCOPE_COMPATIBLE_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${dashscopeApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image } },
            { type: "text", text: promptText },
          ],
        }],
      }),
    });
    const json: any = await upstream.json().catch(() => ({}));
    const text = json?.choices?.[0]?.message?.content ?? "";
    res.status(upstream.status).json({
      text,
      model,
      usage: json?.usage ?? null,
    });
    const tokens = extractTokensFromResponse(json);
    bumpApiUsage(userId, { tokens, requests: 1 }).catch(() => {});
  } catch {
    res.status(502).json({ error: { message: "Upstream error", type: "api_error" } });
  }
});

// ── POST /v1/files — upload file ke dashscope (return file_id) ───────────────
// Pakai multer untuk handle multipart
app.post("/v1/files", requireApiKey, upload.single("file"), async (req, res) => {
  const userId = (req as any).apiUserId;
  const usage = await getApiUsage(userId);
  if (usage.request_count >= API_DAILY_REQUEST_LIMIT) {
    res.status(429).json({ error: { message: "Daily request limit reached.", type: "rate_limit_error" } });
    return;
  }
  const file = (req as any).file;
  if (!file) {
    res.status(400).json({ error: { message: "file field is required (multipart/form-data)", type: "invalid_request_error" } });
    return;
  }
  const purpose = (req.body?.purpose as string) || "file-extract";
  try {
    const fd = new FormData();
    fd.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname);
    fd.append("purpose", purpose);
    const upstream = await fetch(`${DASHSCOPE_COMPATIBLE_BASE}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${dashscopeApiKey}` },
      body: fd as any,
    });
    const text = await upstream.text();
    res.status(upstream.status).type("application/json").send(text);
    bumpApiUsage(userId, { requests: 1 }).catch(() => {});
  } catch {
    res.status(502).json({ error: { message: "Upstream error", type: "api_error" } });
  }
});

// ── DashScope proxy ────────────────────────────────────────────────────────────
app.all("/api/dashscope/*splat", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const today = getTodayWIB();
  const [usageRow, profileRow] = await Promise.all([
    supabaseAdmin.from("daily_token_usage").select("total_tokens").eq("user_id", userId).eq("date", today).single(),
    supabaseAdmin.from("profiles").select("is_premium, premium_expires_at, role").eq("id", userId).single(),
  ]);
  const todayTokens = usageRow.data?.total_tokens ?? 0;
  const isAdmin = profileRow.data?.role === "admin";
  const isPremium = isAdmin || isPremiumActive(profileRow.data ?? {});

  // ── Cek quota token harian ─────────────────────────────────────────────────
  const tokenLimit = isAdmin ? 9_999_999 : isPremium ? PREMIUM_TOKEN_LIMIT : DAILY_TOKEN_LIMIT;
  if (todayTokens >= tokenLimit) {
    res.status(429)
      .set("X-Pioo-Error", "QUOTA_EXCEEDED")
      .json({ error: `Limit harian ${tokenLimit.toLocaleString()} token sudah tercapai. Coba lagi besok ya!` });
    return;
  }

  // ── Cek model restriction (hanya untuk POST dengan body JSON) ──────────────
  const isImageSynthesis = req.path.includes("text2image/image-synthesis");
  const isChatOrText = req.path.includes("chat/completions") || req.path.includes("generation");
  if (!isAdmin && !isPremium && isChatOrText && req.method === "POST") {
    const bodyObj = req.body instanceof Buffer
      ? (() => { try { return JSON.parse(req.body.toString("utf8")); } catch { return {}; } })()
      : (typeof req.body === "object" ? req.body : {});
    const modelName: string = bodyObj?.model ?? "";
    if (modelName && PREMIUM_ONLY_MODELS.has(modelName)) {
      res.status(403)
        .set("X-Pioo-Error", "MODEL_RESTRICTED")
        .json({ error: `Model "${modelName}" hanya tersedia untuk pengguna Plus. Upgrade ke Plus untuk akses penuh!` });
      return;
    }
  }

  // ── Cek & kurangi kuota image gen ──────────────────────────────────────────
  if (!isAdmin && isImageSynthesis && req.method === "POST") {
    const ok = await deductImageGen(userId);
    if (!ok) {
      const quota = await getImageGenQuota(userId);
      res.status(429)
        .set("X-Pioo-Error", "IMAGE_QUOTA_EXCEEDED")
        .json({ error: `Kuota generate gambar hari ini sudah habis (${quota.limit}/hari). Coba lagi besok!` });
      return;
    }
  }
  const dashscopePath = req.path.replace("/api/dashscope", "");
  const queryString = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const targetUrl = `https://dashscope-intl.aliyuncs.com${dashscopePath}${queryString}`;

  const forwardHeaders: Record<string, string> = {
    Authorization: `Bearer ${dashscopeApiKey}`,
  };
  const ct = req.headers["content-type"];
  if (ct) forwardHeaders["Content-Type"] = ct as string;
  for (const [key, val] of Object.entries(req.headers)) {
    if (key.toLowerCase().startsWith("x-dashscope-") && typeof val === "string") {
      forwardHeaders[key] = val;
    }
  }

  const fetchInit: RequestInit = {
    method: req.method,
    headers: forwardHeaders,
  };

  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    if (req.body instanceof Buffer) {
      if (req.body.length > 0) fetchInit.body = req.body;
    } else if (typeof req.body === "object") {
      fetchInit.body = JSON.stringify(req.body);
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, fetchInit);
  } catch (err) {
    console.error("[PioDev API] Upstream fetch error:", err);
    res.status(502).json({ error: "Bad gateway" });
    return;
  }

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    const skip = ["transfer-encoding", "connection", "keep-alive", "content-encoding", "content-length"];
    if (!skip.includes(key.toLowerCase())) res.setHeader(key, value);
  });

  if (!upstream.body) { res.end(); return; }

  const reader = upstream.body.getReader();
  const pump = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        res.write(Buffer.from(value));
      }
    } catch { res.end(); }
  };
  pump();
});

// ─────────────────────────────────────────────────────────────────────────────
// Azure Speech Services — Speech-to-Text (STT) & Text-to-Speech (TTS)
// ─────────────────────────────────────────────────────────────────────────────
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY ?? "";
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION ?? "southeastasia";
const speechAvailable = () => Boolean(AZURE_SPEECH_KEY);

// Suara default Indonesia (Microsoft Neural)
const DEFAULT_TTS_VOICE = "id-ID-ArdiNeural"; // pria Indonesia
// alt: id-ID-GadisNeural (wanita Indonesia)

// Storage in-memory buat audio upload (max 10MB)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// POST /api/voice/transcribe — terima audio (webm/wav/ogg) → balikin text
app.post("/api/voice/transcribe", requireAuth, audioUpload.single("audio"), async (req, res) => {
  if (!speechAvailable()) {
    res.status(503).json({ error: "Azure Speech belum dikonfigurasi" });
    return;
  }
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file || !file.buffer?.length) {
    res.status(400).json({ error: "Audio tidak ditemukan di field 'audio'" });
    return;
  }

  const language = (req.body?.language as string) || "id-ID";
  // Auto-detect content-type dari mime, fallback webm/opus (default MediaRecorder)
  const mime = (file.mimetype || "audio/webm").toLowerCase();
  let contentType = "audio/webm; codecs=opus";
  if (mime.includes("wav")) contentType = "audio/wav; codecs=audio/pcm; samplerate=16000";
  else if (mime.includes("ogg")) contentType = "audio/ogg; codecs=opus";
  else if (mime.includes("webm")) contentType = "audio/webm; codecs=opus";

  const url = `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=detailed`;
  console.log("[Voice STT] req", file.buffer.length, "bytes,", contentType, "lang=" + language);

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
        "Content-Type": contentType,
        "Accept": "application/json",
      },
      body: file.buffer,
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      console.error("[Voice STT] Azure error:", upstream.status, text.slice(0, 200));
      res.status(upstream.status).json({ error: "STT gagal", detail: text.slice(0, 300) });
      return;
    }
    const data = JSON.parse(text);
    const transcript: string =
      data?.DisplayText ||
      data?.NBest?.[0]?.Display ||
      data?.NBest?.[0]?.Lexical ||
      "";
    console.log("[Voice STT] full response:", JSON.stringify(data).slice(0, 400));
    res.json({ text: transcript, raw: data?.RecognitionStatus });
  } catch (err: any) {
    console.error("[Voice STT] Fetch error:", err);
    res.status(502).json({ error: "Gagal connect ke Azure Speech", detail: err?.message });
  }
});

// POST /api/voice/synthesize — terima { text, voice? } → balikin MP3 audio
app.post("/api/voice/synthesize", requireAuth, async (req, res) => {
  if (!speechAvailable()) {
    res.status(503).json({ error: "Azure Speech belum dikonfigurasi" });
    return;
  }
  const text = String(req.body?.text || "").trim();
  if (!text) {
    res.status(400).json({ error: "Field 'text' kosong" });
    return;
  }
  if (text.length > 5000) {
    res.status(400).json({ error: "Text terlalu panjang (max 5000 karakter)" });
    return;
  }

  const voice = String(req.body?.voice || DEFAULT_TTS_VOICE);
  const lang = voice.split("-").slice(0, 2).join("-"); // misal "id-ID"

  // Escape XML untuk SSML
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}"><prosody rate="0%">${escaped}</prosody></voice></speak>`;

  const url = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  console.log("[Voice TTS] req voice=" + voice, "len=" + text.length, JSON.stringify(text.slice(0, 60)));

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "PioDev",
      },
      body: ssml,
    });
    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("[Voice TTS] Azure error:", upstream.status, errText.slice(0, 200));
      res.status(upstream.status).json({ error: "TTS gagal", detail: errText.slice(0, 300) });
      return;
    }
    const arrayBuf = await upstream.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");
    res.send(Buffer.from(arrayBuf));
  } catch (err: any) {
    console.error("[Voice TTS] Fetch error:", err);
    res.status(502).json({ error: "Gagal connect ke Azure Speech", detail: err?.message });
  }
});

// GET /api/voice/voices — list suara yang tersedia (static, paling umum buat ID/EN)
app.get("/api/voice/voices", requireAuth, (_req, res) => {
  res.json({
    available: speechAvailable(),
    voices: [
      { id: "id-ID-ArdiNeural",  name: "Ardi (Pria, Indonesia)",  lang: "id-ID" },
      { id: "id-ID-GadisNeural", name: "Gadis (Wanita, Indonesia)", lang: "id-ID" },
      { id: "en-US-AndrewNeural", name: "Andrew (Pria, US)",      lang: "en-US" },
      { id: "en-US-AvaNeural",    name: "Ava (Wanita, US)",        lang: "en-US" },
      { id: "en-US-EmmaNeural",   name: "Emma (Wanita, US)",       lang: "en-US" },
      { id: "ja-JP-NanamiNeural", name: "Nanami (Wanita, Jepang)", lang: "ja-JP" },
    ],
    default: DEFAULT_TTS_VOICE,
  });
});

// Cek apakah port sudah dipakai sebelum mencoba bind
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createConnection({ port, host: "127.0.0.1" });
    tester.once("connect", () => { tester.destroy(); resolve(true); });
    tester.once("error", () => resolve(false));
    tester.setTimeout(200, () => { tester.destroy(); resolve(false); });
  });
}

// Serve static files in production (dist/public built by Vite)
if (IS_PRODUCTION) {
  const staticDir = path.join(__dirname, "..", "dist", "public");
  app.use(express.static(staticDir));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

const portTaken = IS_PRODUCTION ? false : await isPortInUse(SERVER_PORT);
if (portTaken) {
  console.log(`[PioDev API] Port ${SERVER_PORT} sudah dipakai instance lain. Skip start server.`);
  // Jaga event loop tetap hidup agar Vite di concurrently tidak mati
  setInterval(() => {}, 60_000);
} else {
  const server = app.listen(SERVER_PORT, "0.0.0.0", () => {
    console.log(`[PioDev API] Secure proxy running on port ${SERVER_PORT}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error("[PioDev API] Server error:", err.code, err.message);
    // Jika port tetiba ditangkap instance lain, tetap jaga proses
    setInterval(() => {}, 60_000);
  });

  process.on("uncaughtException", (err) => {
    console.error("[PioDev API] Uncaught exception:", err);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[PioDev API] Unhandled rejection:", reason);
  });
}
