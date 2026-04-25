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

- **AI Chat** dengan streaming, thinking mode, web search, code artifacts
- **Image Generation** (Qwen Image models) — kuota harian tier-aware (Free: 7/hari, Plus: 25/hari, Pro: 40/hari)
- **Video Studio** (/video-studio) — text-to-video/image-to-video (Wan series), kredit bulanan tier-aware (Free: 3/bln, Plus: 12/bln, Pro: 20/bln)
- **Artifact Panel** — preview kode HTML/CSS/JS langsung di chat
- **Admin Dashboard** — RBAC (user/admin), manage users, kasih/cabut tier Plus/Pro langsung dari tab Pengguna
- **Personalization** — custom system prompt, persona settings
- **What's New** — changelog dengan notifikasi badge
- **Pricing Page (`/premium`)** — 3 kartu Free / Plus / Pro. Tombol Plus & Pro = "Pilih & Beli Sekarang" → munculin toast "Payment gateway segera hadir" (placeholder, gateway belum aktif). Promo lama "Klaim Plus gratis lewat Instagram" SUDAH DIHAPUS (event berakhir): halaman `/premium/apply`, hook `apply()`, tab admin "Plus Terbatas", banner Chat "Follow IG", semua copy "Klaim Plus" — semua hilang. Endpoint server `/api/premium/apply`, `/api/premium/upload-screenshots`, dan `/api/admin/premium-applications/*` sekarang return **HTTP 410 Gone** dengan pesan "Fitur klaim Plus via Instagram sudah berakhir." (stub dipertahankan supaya client lama gak crash). Admin masih bisa kasih Plus/Pro manual via `PATCH /api/admin/users/:id/premium` dari dashboard.
- **API Keys (BYOK) — Plus only** — Plus & Admin user generate `pio-sk-...` untuk akses PioCode API dari luar. Key disimpan ter-enkripsi (AES-256-GCM via `API_KEY_ENCRYPTION_SECRET`) → bisa di-reveal & copy ulang kayak Gemini AI Studio. Free user GAK bisa bikin (403 + CTA upgrade).
- **Saldo Credit (REAL IDR, persisten)** — kolom `profiles.credit_balance_idr` (INTEGER) + tabel ledger `credit_transactions` (RLS aktif, lihat `server/credit-system-migration.sql` — wajib jalanin manual via Supabase Dashboard SQL Editor sekali). Saldo TIDAK reset harian. Konversi: **2 token = Rp 1** (cost = `ceil(tokens / 2)`); tarif tetap: image Rp 4.000, video Rp 50.000. Saat user di-approve jadi Plus/Pro, otomatis dapet bonus tier-aware via `grantTierBonusOnce` (Plus: `Rp 75.000` sekali via ledger `bonus_plus_upgrade`; Pro: `Rp 125.000` sekali via `bonus_pro_upgrade`; kalau user upgrade Plus→Pro, hanya selisih `Rp 50.000` yang ditambah). Admin bypass (gak di-charge tapi tetap masuk log). Endpoint: `GET /api/me/credit` (saldo + 20 transaksi terakhir + pricing termasuk `pro_bonus_idr`) & `POST /api/me/credit/top-up` (503 `coming_soon` placeholder). Helpers: `getCreditBalance / addCredit / deductCredit / grantTierBonusOnce` di `server/index.ts` — fail-safe try/catch supaya app gak crash kalau migrasi belum jalan. UI: `SaldoCard` di `src/pages/api-keys.tsx` (badge berbeda Plus vs Pro), free user lihat error message upgrade.

- **Sistem Tier 3-Tingkat (Free / Plus / Pro)** — kolom `profiles.tier TEXT NOT NULL DEFAULT 'free'` (CHECK constraint `('free','plus','pro')`). Migrasi: jalanin `server/tier-system-migration.sql` manual via Supabase Dashboard SQL Editor (idempotent, backfill `is_premium=true` → `tier='plus'`). Kolom `is_premium` boolean tetap dipake untuk back-compat — sekarang artinya `tier IN ('plus','pro')`. Helper di server: `getTier(profile)` & `getTierLimits(tier, isAdmin)`. Konstanta: `FREE/PLUS/PRO_TOKEN_LIMIT` (60k/200k/360k), `FREE/PLUS/PRO_IMAGE_LIMIT` (7/25/40), `FREE/PLUS/PRO_VIDEO_CREDITS` (3/12/20). Endpoint admin terima `body.tier`: `PATCH /api/admin/users/:id/premium`. Response API include `tier` field: `/api/me/quota`, `/api/me/usage-summary`, `/api/premium/status`, `/api/me/credit`, `/api/admin/users`. Tabel `premium_applications` SUDAH DI-DROP — migrasi `server/drop-premium-applications-migration.sql` (jalanin manual via Supabase Dashboard SQL Editor, idempotent dengan `DROP TABLE IF EXISTS ... CASCADE`). Endpoint apply/approve/reject tetap return 410 Gone sebagai stub.

## Sistem Hak Akses (Privilege)

| Fitur | Free | Plus | Pro | Admin |
|-------|------|------|-----|-------|
| Token harian | 60K | 200K | 360K | Unlimited |
| Model | Mini only | All (Plus, Coder, Mini) | All | All |
| Image gen / hari | 7 | 25 | 40 | Unlimited |
| Video kredit / bulan | 3 | 12 | 20 | Unlimited |
| Bonus saldo upgrade | — | Rp 75.000 | Rp 125.000 (Plus→Pro: selisih Rp 50.000) | — |
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

