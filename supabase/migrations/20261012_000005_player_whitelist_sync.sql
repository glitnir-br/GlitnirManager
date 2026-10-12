alter table public.players add column if not exists personagens text[] not null default '{}';
alter table public.players add column if not exists na_whitelist boolean not null default false;
alter table public.players add column if not exists whitelist_sincronizada boolean not null default false;
alter table public.players add column if not exists whitelist_synced_at timestamptz;

create index if not exists players_server_whitelist_idx
  on public.players (server, na_whitelist);
