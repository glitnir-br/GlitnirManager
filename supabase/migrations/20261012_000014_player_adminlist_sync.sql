alter table public.players add column if not exists is_server_admin boolean not null default false;
alter table public.players add column if not exists adminlist_synced_at timestamptz;

create index if not exists players_server_admin_idx on public.players (server, is_server_admin);
