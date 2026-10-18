create table if not exists public.player_item_deliveries (
  id uuid primary key default gen_random_uuid(),
  operation_key uuid not null unique,
  player_id uuid references public.players(id) on delete set null,
  steamid text not null,
  character_name text not null,
  server text not null check (server in ('server_1', 'server_2')),
  friendly_name text not null,
  prefab text not null,
  quantity integer not null check (quantity > 0),
  quality integer not null check (quality > 0),
  status text not null check (status in ('em_processamento', 'entregue', 'falhou', 'resultado_incerto')),
  command text not null,
  response text,
  error text,
  created_by text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists player_item_deliveries_server_created_idx
  on public.player_item_deliveries (server, created_at desc);
create index if not exists player_item_deliveries_player_idx
  on public.player_item_deliveries (steamid, created_at desc);

alter table public.player_item_deliveries enable row level security;

notify pgrst, 'reload schema';
