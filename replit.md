# PioDev

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
- **Image Generation** (Qwen Image models) — kuota harian tier-aware (Free: 7/hari, Plus: 25/hari)
- **Video Studio** (/video-studio) — text-to-video/image-to-video (Wan series), kredit bulanan tier-aware (Free: 3/bln, Plus: 12/bln)
- **Artifact Panel** — preview kode HTML/CSS/JS langsung di chat
- **Admin Dashboard** — RBAC (user/admin), manage users, approve/reject premium applications
- **Personalization** — custom system prompt, persona settings
- **What's New** — changelog dengan notifikasi badge
- **Freemium Tier (Penawaran Plus Terbatas)** — verifikasi follow Instagram untuk akses Plus

## Sistem Hak Akses (Privilege)

| Fitur | Free | Plus | Admin |
|-------|------|------|-------|
| Token harian | 60K | 360K | Unlimited |
| Model | Mini only | All (Plus, Coder, Mini) | All |
| Image gen / hari | 7 | 25 | Unlimited |
| Video kredit / bulan | 3 | 12 | Unlimited |
| Badge | — | "Plus" | "Admin" |

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

