alter table public.banidos add column if not exists personagens text[] not null default '{}';
alter table public.banidos add column if not exists na_banlist boolean not null default false;
alter table public.banidos add column if not exists banlist_sincronizada boolean not null default false;
alter table public.banidos add column if not exists banlist_synced_at timestamptz;

create index if not exists banidos_server_banlist_idx
  on public.banidos (server, na_banlist);
