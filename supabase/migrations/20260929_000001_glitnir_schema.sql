create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(), nick text not null, steamid text not null,
  status text not null default 'ativo', guilda text, observacao text, cor text,
  duplicado boolean not null default false, ordem integer, created_date timestamptz not null default now(), updated_at timestamptz
);
create table if not exists public.financas (
  id uuid primary key default gen_random_uuid(), data date, nick text, gc text, enviado_por text,
  valor numeric(12,2) not null default 0, nome text, tipo text, observacao text,
  created_date timestamptz not null default now(), updated_at timestamptz
);
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(), data date, nick text not null, produto text not null,
  valor numeric(12,2) not null default 0, guilda text, created_date timestamptz not null default now(), updated_at timestamptz
);
create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(), data date, descricao text not null,
  valor numeric(12,2) not null default 0, categoria text, observacao text,
  status_pagamento text not null default 'nao_pago', created_date timestamptz not null default now(), updated_at timestamptz
);
create table if not exists public.banidos (
  id uuid primary key default gen_random_uuid(), nick text, steamid text, motivo text not null default 'OUTRO',
  observacao text, created_date timestamptz not null default now(), updated_at timestamptz
);
create table if not exists public.gc_tabelas (
  id uuid primary key default gen_random_uuid(), reais numeric(12,2) not null default 0,
  gc numeric(12,2) not null default 0, ordem integer not null default 0, created_date timestamptz not null default now(), updated_at timestamptz
);
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(), email text not null unique, full_name text, role text not null default 'visitante',
  status text not null default 'pendente', approved_by text, approved_date timestamptz, two_fa_enabled boolean not null default false,
  backup_codes text, created_date timestamptz not null default now(), updated_at timestamptz
);
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(), email text not null, status text not null default 'pendente', role text,
  created_date timestamptz not null default now(), updated_at timestamptz
);
create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(), setting_key text not null unique, admin_password text,
  updated_by text, created_date timestamptz not null default now(), updated_at timestamptz
);
create table if not exists public.security_logs (
  id uuid primary key default gen_random_uuid(), action text not null, user_email text, performed_by text,
  details text, ip_address text, timestamp timestamptz not null default now(), created_date timestamptz not null default now()
);

create index if not exists players_steamid_idx on public.players (steamid);
create index if not exists banidos_steamid_idx on public.banidos (steamid);
create index if not exists user_profiles_email_idx on public.user_profiles (email);
create index if not exists access_requests_status_idx on public.access_requests (status);
create index if not exists security_logs_user_email_idx on public.security_logs (user_email);

-- Dados financeiros, configurações administrativas e auditoria não devem ser
-- expostos à chave pública. As políticas devem ser adicionadas somente depois
-- que o login da aplicação estiver integrado ao Supabase Auth.
alter table public.players enable row level security;
alter table public.financas enable row level security;
alter table public.compras enable row level security;
alter table public.despesas enable row level security;
alter table public.banidos enable row level security;
alter table public.gc_tabelas enable row level security;
alter table public.user_profiles enable row level security;
alter table public.access_requests enable row level security;
alter table public.admin_settings enable row level security;
alter table public.security_logs enable row level security;
