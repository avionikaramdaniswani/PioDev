-- ============================================================
-- PioDev — Supabase Schema
-- Jalankan ini di: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Tabel conversations
create table if not exists conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Tabel messages
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'ai')),
  content text not null,
  created_at timestamptz default now() not null
);

-- 3. Row Level Security (RLS) — data user hanya bisa diakses pemiliknya
alter table conversations enable row level security;
alter table messages enable row level security;

-- RLS: conversations
create policy "Lihat conversation sendiri" on conversations
  for select using (auth.uid() = user_id);

create policy "Buat conversation" on conversations
  for insert with check (auth.uid() = user_id);

create policy "Update conversation sendiri" on conversations
  for update using (auth.uid() = user_id);

create policy "Hapus conversation sendiri" on conversations
  for delete using (auth.uid() = user_id);

-- RLS: messages
create policy "Lihat pesan di conversation sendiri" on messages
  for select using (
    exists (select 1 from conversations where id = conversation_id and user_id = auth.uid())
  );

create policy "Kirim pesan di conversation sendiri" on messages
  for insert with check (
    exists (select 1 from conversations where id = conversation_id and user_id = auth.uid())
  );

create policy "Hapus pesan di conversation sendiri" on messages
  for delete using (
    exists (select 1 from conversations where id = conversation_id and user_id = auth.uid())
  );

-- 4. Index untuk performa
create index if not exists conversations_user_id_idx on conversations(user_id);
create index if not exists conversations_updated_at_idx on conversations(updated_at desc);
create index if not exists messages_conversation_id_idx on messages(conversation_id);
