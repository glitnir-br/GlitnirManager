alter table public.financas
  add column if not exists player_id uuid references public.players(id) on delete set null,
  add column if not exists steamid text,
  add column if not exists personagem text,
  add column if not exists moeda_enviada boolean not null default false,
  add column if not exists moeda_enviada_at timestamptz;

update public.financas
set personagem = nick
where personagem is null and nick is not null;

create index if not exists financas_server_player_idx
  on public.financas (server, player_id);

create index if not exists financas_server_moeda_enviada_idx
  on public.financas (server, moeda_enviada);
