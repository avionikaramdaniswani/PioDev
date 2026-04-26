# PioCode

Platform chatbot AI berbasis React + Supabase.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **Package manager**: pnpm
- **Frontend**: React 19, Vite, Tailwind CSS v4, Wouter, Framer Motion
- **Auth & DB**: Supabase (auth + PostgreSQL)
- **UI components**: Radix UI / shadcn pattern
- **Markdown**: react-markdown, react-syntax-highlighter

## Fitur Utama

- **AI Chat** dengan streaming, thinking mode, web search, code artifacts. **Background Generation (refresh-safe, mirip ChatGPT)**: client gak streaming langsung ke Qwen — gantinya panggil `POST /api/chat/bg-generate` (insert AI placeholder + spawn `setImmediate` background task yang stream Qwen + simpan partial content ke DB tiap ~800ms). Client poll `GET /api/chat/bg-poll/:msgId` setiap 800ms (poll pertama 200ms biar responsive) untuk update UI. **Refresh during generation = aman**: server tetep lanjut generate; saat user balik, `loadChats` deteksi AI message dengan `total_tokens IS NULL` + created < 10 menit → auto-spawn polling lagi. Konvensi DONE: `total_tokens` ≠ NULL (server selalu set saat selesai). Helper di `use-chat.tsx`: `pollGeneration(chatId, aiMsgId, signal)` returning `{content, tokenUsage, timedOut}` — pake `pollingMsgIdsRef` Set untuk hindari duplicate polling. Server helper `bumpDailyTokenUsage` write ke `daily_token_usage` (gantiin client-side `recordTokenUsageToDB` untuk path bg-generate); client tetep dispatch `pioo:token-usage-bump` event untuk optimistic UI counter update. Quota & premium-model check tetep di server (sebelum spawn bg). Stop button = abort polling client (server tetep generate, hasil muncul saat reload). Image gen, voice mode, regenerate path TIDAK pakai bg-generate (tetep client streaming).
- **Image Generation** (Qwen Image models) — kuota harian tier-aware (Free: 7/hari, Plus: 25/hari, Pro: 40/hari)
- **Video Studio** (/video-studio) — text-to-video/image-to-video (Wan series), kredit bulanan tier-aware (Free: 3/bln, Plus: 12/bln, Pro: 20/bln)
- **Artifact Panel** — preview kode HTML/CSS/JS langsung di chat
- **Admin Dashboard** — RBAC (user/admin), manage users, kasih/cabut tier Plus/Pro langsung dari tab Pengguna. Tab "Harga & Promo" untuk edit harga Plus/Pro + diskon (%) + label promo, langsung sync ke pricing page (cache TTL 60s, invalidate on save). Backed by tabel `app_config (key, value JSONB)` — jalanin `server/app-config-migration.sql` sekali via Supabase. Server fallback ke DEFAULT_PRICING (Plus 10rb, Pro 18rb) kalau tabel belum ada.
- **Personalization** — custom system prompt, persona settings
- **What's New** — changelog dengan notifikasi badge
- **Pricing Page (`/premium`)** — 3 kartu Free / Plus / Pro. Tombol Plus & Pro = "Pilih & Beli Sekarang" → munculin toast "Payment gateway segera hadir" (placeholder, gateway belum aktif). Promo lama "Klaim Plus gratis lewat Instagram" SUDAH DIHAPUS (event berakhir): halaman `/premium/apply`, hook `apply()`, tab admin "Plus Terbatas", banner Chat "Follow IG", semua copy "Klaim Plus" — semua hilang. Endpoint server `/api/premium/apply`, `/api/premium/upload-screenshots`, dan `/api/admin/premium-applications/*` sekarang return **HTTP 410 Gone** dengan pesan "Fitur klaim Plus via Instagram sudah berakhir." (stub dipertahankan supaya client lama gak crash). Admin masih bisa kasih Plus/Pro manual via `PATCH /api/admin/users/:id/premium` dari dashboard.
- **Plus Free Trial (1 bulan, sekali per akun)** — kartu Plus di `/premium` punya secondary CTA "Ambil Gratis Uji Coba 1 Bulan" untuk user Free yang belum pernah klaim. Klik → modal konfirmasi (rincian benefit + warning sekali pakai) → `POST /api/premium/claim-trial`. Server validasi: `email_confirmed_at` harus ada (anti farming → 403), `profiles.trial_claimed_at` harus null (→ 409), tier harus `free` (→ 409). Sukses → set `tier='plus'`, `is_premium=true`, `premium_expires_at = NOW + 30 hari`, `trial_claimed_at=NOW`, lalu kasih bonus saldo `Rp 75.000` via ledger type **`bonus_plus_trial`** (TERPISAH dari `bonus_plus_upgrade` — supaya nanti user yang upgrade ke paket Plus berbayar TETAP dapat bonus 75k lagi via `grantTierBonusOnce`). **Total maksimum bonus per user**: 150k (75k trial + 75k saat upgrade berbayar). Re-klaim trial dicegah oleh kolom `trial_claimed_at` (bukan oleh idempotency cek ledger). Setelah 30 hari user otomatis balik ke Free (tier-aware logic udah handle expired premium_expires_at). Migrasi: `server/trial-system-migration.sql` (nambah kolom `trial_claimed_at TIMESTAMPTZ` + index parsial — jalanin manual sekali via Supabase Dashboard SQL Editor). Konstanta server: `PLUS_TRIAL_BONUS_IDR=75_000`, `PLUS_TRIAL_DURATION_DAYS=30`. Response `/api/premium/status` sekarang include `trialClaimedAt` & `trialAvailable`. Tombol jadi disabled "Uji Coba Sudah Diklaim" kalau `trial_claimed_at` ≠ null. **Cross-promo**: dialog Top Up di `/api-keys` (saat user klik "Top up Segera") nampilin info "payment gateway segera hadir" + tombol CTA "Ambil Trial 1 Bulan →" yang redirect ke `/premium`.
- **API Keys (BYOK) — Plus only** — Plus & Admin user generate `pio-sk-...` untuk akses PioCode API dari luar. Key disimpan ter-enkripsi (AES-256-GCM via `API_KEY_ENCRYPTION_SECRET`) → bisa di-reveal & copy ulang kayak Gemini AI Studio. Free user GAK bisa bikin (403 + CTA upgrade).
- **Saldo Credit (REAL IDR, persisten)** — kolom `profiles.credit_balance_idr` (INTEGER) + tabel ledger `credit_transactions` (RLS aktif, lihat `server/credit-system-migration.sql` — wajib jalanin manual via Supabase Dashboard SQL Editor sekali). Saldo TIDAK reset harian. Konversi: **2 token = Rp 1** (cost = `ceil(tokens / 2)`); tarif tetap: image Rp 4.000, video Rp 50.000. Saat user di-approve jadi Plus/Pro, otomatis dapet bonus tier-aware via `grantTierBonusOnce` (Plus: `Rp 75.000` sekali via ledger `bonus_plus_upgrade`; Pro: `Rp 125.000` sekali via `bonus_pro_upgrade`; kalau user upgrade Plus→Pro, hanya selisih `Rp 50.000` yang ditambah). Admin bypass (gak di-charge tapi tetap masuk log). Endpoint: `GET /api/me/credit` (saldo + 20 transaksi terakhir + pricing termasuk `pro_bonus_idr`) & `POST /api/me/credit/top-up` (503 `coming_soon` placeholder). Helpers: `getCreditBalance / addCredit / deductCredit / grantTierBonusOnce` di `server/index.ts` — fail-safe try/catch supaya app gak crash kalau migrasi belum jalan. UI: `SaldoCard` di `src/pages/api-keys.tsx` (badge berbeda Plus vs Pro), free user lihat error message upgrade.

- **Pustaka (Knowledge Base)** (`/pustaka`) — user upload dokumen reusable yang bisa di-attach ke chat manapun. **Limit per tier** (sumber kebenaran: konstanta di `server/index.ts`): Free 10MB/file, 10 file, 100 halaman/bulan; Plus 20MB/file, 20 file, 1.000 halaman/bulan; Pro 30MB/file, 35 file, 5.000 halaman/bulan. Stack: tabel `documents` (id, user_id, name, file_path, file_type, size_bytes, page_count, extracted_text TEXT, parse_status, parse_error, tags) + tabel `document_page_usage` (kuota halaman bulanan, key per user+month YYYY-MM WIB) + storage bucket `pustaka` (200MB cap, RLS by user folder). **Parsing**: text/code/json/markdown → UTF-8 inline (cap 500K chars); PDF + image (PNG/JPG/WebP) → **Azure Document Intelligence** (`prebuilt-read`, polling sampe 60s) — pakai env `AZURE_DOC_INTELLIGENCE_KEY` & `AZURE_DOC_INTELLIGENCE_ENDPOINT`, count `pageCount` dari `analyzeResult.pages.length`. Kalau kuota halaman habis → file tetap kesimpan tapi `parse_status='skipped'` + `parse_error` dengan pesan. Helper: `getPustakaLimits(tier, isAdmin)`, `getMonthlyPageUsage(userId)`, `incrementMonthlyPageUsage`, `azureExtractText`, `isTextFile`. Endpoint: `POST /api/pustaka` (multer 200MB), `GET /api/pustaka` (list), `GET /api/pustaka/usage` (kuota), `GET /api/pustaka/:id/text` (untuk attach ke chat), `DELETE /api/pustaka/:id`, `PATCH /api/pustaka/:id` (rename/tags). UI: `src/pages/pustaka.tsx` (drag-drop + cards + status badges + auto-poll tiap 3s untuk doc processing) + `src/components/pustaka-picker-dialog.tsx` (multi-select dialog dipanggil dari menu attach chat — opsi ke-3 "Dari Pustaka" di samping Tambah Foto/Tambah File). Sidebar nav: icon `Library` di sidebar collapse + expanded section di bawah Pio Studio. **Migrasi**: `server/pustaka-migration.sql` (idempotent — table + RLS + bucket + storage policies) — **WAJIB jalanin manual sekali via Supabase Dashboard SQL Editor**.

- **Sistem Tier 3-Tingkat (Free / Plus / Pro)** — kolom `profiles.tier TEXT NOT NULL DEFAULT 'free'` (CHECK constraint `('free','plus','pro')`). Migrasi: jalanin `server/tier-system-migration.sql` manual via Supabase Dashboard SQL Editor (idempotent, backfill `is_premium=true` → `tier='plus'`). Kolom `is_premium` boolean tetap dipake untuk back-compat — sekarang artinya `tier IN ('plus','pro')`. Helper di server: `getTier(profile)` & `getTierLimits(tier, isAdmin)`. Konstanta: `FREE/PLUS/PRO_TOKEN_LIMIT` (60k/200k/360k), `FREE/PLUS/PRO_IMAGE_LIMIT` (7/25/40), `FREE/PLUS/PRO_VIDEO_CREDITS` (3/12/20). Endpoint admin terima `body.tier`: `PATCH /api/admin/users/:id/premium`. Response API include `tier` field: `/api/me/quota`, `/api/me/usage-summary`, `/api/premium/status`, `/api/me/credit`, `/api/admin/users`. Tabel `premium_applications` SUDAH DI-DROP — migrasi `server/drop-premium-applications-migration.sql` (jalanin manual via Supabase Dashboard SQL Editor, idempotent dengan `DROP TABLE IF EXISTS ... CASCADE`). Endpoint apply/approve/reject tetap return 410 Gone sebagai stub.

## Sistem Hak Akses (Privilege)

| Fitur | Free | Plus | Pro | Admin |
|-------|------|------|-----|-------|
| Token harian | 60K | 200K | 360K | Unlimited |
| Model | Mini only | All (Plus, Coder, Mini) | All | All |
| Image gen / hari | 7 | 25 | 40 | Unlimited |
| Video kredit / bulan | 3 | 12 | 20 | Unlimited |
| Pustaka file size | 10 MB | 20 MB | 30 MB | Unlimited |
| Pustaka jumlah file | 10 | 20 | 35 | Unlimited |
| Pustaka halaman / bulan | 100 | 1.000 | 5.000 | Unlimited |
| Bonus saldo upgrade (one-time) | — | Rp 75.000 | Rp 125.000 (Plus→Pro: selisih Rp 50.000) | — |
| Harga display | Rp 0 | Rp 10.000/bln | Rp 18.000/bln | — |
| Badge | — | "Plus" | "Pro" | "Admin" |

- Server memblokir model premium untuk user Free (403 MODEL_RESTRICTED)
- Kuota image gen di-track di kolom `image_gen_count` + `image_gen_reset_date` di tabel `profiles`
- Video credits reset BULANAN (bukan harian) sejak pembaruan terbaru

## Struktur

```
piodev/
├── artifacts/
│   └── piodev/          # Frontend utama (React + Vite)
│       ├── src/
│       │   ├── pages/   # chat.tsx, login.tsx, register.tsx, forgot-password.tsx, video-studio.tsx, settings.tsx, admin.tsx, whats-new.tsx
│       │   ├── hooks/   # use-auth.tsx, use-chat.tsx, use-theme.tsx, use-personalization.tsx, use-token-usage.tsx
│       │   ├── lib/     # supabase.ts, utils.ts
│       │   └── components/
│       ├── server/      # Express proxy (port 3099) — DashScope API, auth, admin endpoints
│       ├── vite.config.ts
│       └── package.json
├── railway.json          # Konfigurasi deploy Railway
├── .env.example          # Contoh env variables yang dibutuhkan
└── pnpm-workspace.yaml
```

## Environment Variables

Wajib diisi (di Replit: Secrets, di Railway: Variables):

| Nama | Keterangan |
|------|------------|
| `VITE_SUPABASE_URL` | URL project Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon/public key Supabase |

Opsional (otomatis diisi runtime):

| Nama | Default |
|------|---------|
| `PORT` | `3000` |
| `BASE_PATH` | `/` |

## Supabase Schema

Jalankan `artifacts/piodev/supabase-schema.sql` di Supabase SQL Editor untuk setup tabel `conversations` dan `messages` beserta RLS policies.

### Video Jobs (Pio Studio)

Tabel `video_jobs` menyimpan riwayat generate video per user (sinkron antar device). Jalankan migrasi terbaru di `artifacts/piodev/server/migration.sql` untuk membuat tabel ini. Data yang disimpan: prompt, model, status, video URL (bukan file video). RLS policy memastikan setiap user hanya bisa akses video mereka sendiri.

### Credit System (Video)

Kolom `video_credits` dan `video_credits_reset_date` di tabel `profiles`. Setiap user biasa mendapat 2 kredit/hari (reset otomatis jam 00:00 WIB). Admin mendapat unlimited. Kredit hanya dikurangi setelah video berhasil disubmit ke DashScope API. Konstanta: `DAILY_VIDEO_CREDITS = 2` di server/index.ts.

### Admin Dashboard — Pengguna Tab

Tab `Pengguna` di `/admin` (komponen `SectionPengguna` di `src/pages/admin.tsx`) sekarang punya:
- **Filter**: Tier (free/plus/pro), Role (user/admin), Status (active/expiring ≤7h/expired).
- **Sort**: Terbaru, Terlama, Login Terakhir, Saldo Tertinggi/Terendah, Expires Terdekat.
- **Pagination**: 20 baris per halaman.
- **Kolom**: Pengguna, Role/Tier, Saldo (Rupiah, sm+), Expires (badge dengan warna sesuai status, md+), Bergabung (lg+), Login Terakhir (xl+).
- **Aksi**: Tombol `⋮` (DropdownMenu) → "Detail Pengguna" (buka `UserDetailSheet`), "Edit" (buka `EditUserDialog`), atau "Hapus" (AlertDialog konfirmasi).

`UserDetailSheet` adalah side panel (Sheet dari kanan, max-w-md) yang menampilkan profil lengkap user secara read-only: avatar inisial, nama+email, badge status (Role, Tier, Trial Claimed/Belum klaim), section Akses & Premium (role, tier, status premium dengan countdown, expires), section Saldo & Trial (saldo sekarang, tanggal klaim trial atau "Belum diklaim"), section Aktivitas (bergabung, login terakhir — dua-duanya dengan jam:menit), Identifier (UUID + tombol copy), serta tombol aksi cepat Edit/Hapus di bawah. Dipakai buat support/audit cepat tanpa harus buka dialog edit.

`EditUserDialog` adalah dialog tunggal yang mengkonsolidasi semua editing user: role (user/admin), tier (free/plus/pro) + durasi (preset 7h–1th atau kustom hari/bulan), dan saldo (mode "Tambah/Kurangi" atau "Set Eksak" + catatan opsional). Dialog memanggil endpoint sesuai field yang berubah.

**Endpoint baru**: `PATCH /api/admin/users/:id/credit` — body `{ mode: "set"|"add", amount_idr, note? }`. Mode `set` menimpa saldo (tidak boleh negatif), mode `add` menambah/mengurangi (clamp ≥ 0). Setiap perubahan dicatat ke `credit_transactions` sebagai `admin_credit_add`/`admin_credit_deduct` dengan metadata `{ admin_id, mode, note, previous_balance }` untuk audit trail. `GET /api/admin/users` juga sekarang mengembalikan `credit_balance_idr` dan `trial_claimed_at`.

## Development

```bash
# Install dependencies
pnpm install

# Jalankan dev server
pnpm --filter @workspace/piodev run dev
```

## Deploy ke Railway

1. Buat project baru di [railway.app](https://railway.app)
2. Connect ke repo ini
3. Tambahkan environment variables: `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`
4. Railway otomatis build & deploy menggunakan `railway.json`

Build command: `pnpm install --frozen-lockfile && pnpm --filter @workspace/piodev run build`
Start command: `pnpm --filter @workspace/piodev run serve`

