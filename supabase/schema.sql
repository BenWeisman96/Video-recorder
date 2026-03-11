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

create table if not exists debug_logs (
  id bigint generated always as identity primary key,
  app_name text not null default 'mini-zoom-share',
  level text not null default 'info',
  source text not null,
  message text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_debug_logs_created_at on debug_logs(created_at desc);
create index if not exists idx_debug_logs_app_name on debug_logs(app_name);
