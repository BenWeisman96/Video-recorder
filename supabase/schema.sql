create extension if not exists pgcrypto;

create table if not exists recordings (
  id uuid primary key,
  title text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references recordings(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  view_count int not null default 0,
  last_viewed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_share_links_expires_at on share_links(expires_at);
