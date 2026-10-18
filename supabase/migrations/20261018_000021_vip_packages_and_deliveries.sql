create table if not exists public.vip_packages (
  id uuid primary key default gen_random_uuid(), name text not null, description text,
  price numeric(12,2) not null check (price >= 0), active boolean not null default true,
  created_by text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.vip_package_items (
  id uuid primary key default gen_random_uuid(), package_id uuid not null references public.vip_packages(id) on delete cascade,
  friendly_name text not null, prefab text not null, quantity integer not null check (quantity > 0),
  quality integer not null default 1 check (quality > 0), max_quality integer, sort_order integer not null default 0,
  unique(package_id, prefab, quality)
);
create table if not exists public.vip_deliveries (
  id uuid primary key default gen_random_uuid(), operation_key uuid not null unique,
  package_id uuid references public.vip_packages(id) on delete set null, package_name text not null,
  price numeric(12,2) not null check (price >= 0), player_id uuid references public.players(id) on delete set null,
  steamid text not null, character_name text not null, server text not null check (server in ('server_1','server_2')),
  payment_date timestamptz not null, payment_method text, admin_note text, created_by text not null,
  status text not null default 'pendente' check (status in ('pendente','aguardando_online','em_processamento','concluida','parcial','falhou','resultado_incerto','cancelada')),
  financial_id uuid, created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz
);
create table if not exists public.vip_delivery_items (
  id uuid primary key default gen_random_uuid(), delivery_id uuid not null references public.vip_deliveries(id) on delete restrict,
  friendly_name text not null, prefab text not null, quantity integer not null check (quantity > 0), quality integer not null check (quality > 0),
  sort_order integer not null default 0, status text not null default 'pendente' check (status in ('pendente','em_processamento','entregue','falhou','resultado_incerto')),
  command text, response text, error text, attempted_at timestamptz, completed_at timestamptz
);
create table if not exists public.vip_memberships (
  id uuid primary key default gen_random_uuid(), server text not null check (server in ('server_1','server_2')),
  steamid text not null, character_name text not null, player_id uuid references public.players(id) on delete set null,
  delivery_id uuid not null unique references public.vip_deliveries(id) on delete restrict, active boolean not null default true,
  created_at timestamptz not null default now(), unique(server, steamid)
);
alter table public.financas add column if not exists vip_delivery_id uuid unique references public.vip_deliveries(id) on delete restrict;
alter table public.financas add column if not exists categoria text;
alter table public.financas add column if not exists forma_pagamento text;
alter table public.vip_deliveries drop constraint if exists vip_deliveries_financial_id_fkey;
alter table public.vip_deliveries add constraint vip_deliveries_financial_id_fkey foreign key (financial_id) references public.financas(id) on delete restrict;
create index if not exists vip_deliveries_status_idx on public.vip_deliveries(status, created_at desc);
create index if not exists vip_deliveries_player_idx on public.vip_deliveries(server, steamid);
create index if not exists vip_delivery_items_delivery_idx on public.vip_delivery_items(delivery_id, sort_order);
alter table public.vip_packages enable row level security;
alter table public.vip_package_items enable row level security;
alter table public.vip_deliveries enable row level security;
alter table public.vip_delivery_items enable row level security;
alter table public.vip_memberships enable row level security;

create or replace function public.create_vip_delivery(
  p_operation_key uuid, p_package_id uuid, p_player_id uuid, p_steamid text, p_character_name text,
  p_server text, p_payment_date timestamptz, p_payment_method text, p_admin_note text, p_created_by text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_package vip_packages%rowtype; v_delivery_id uuid; v_financial_id uuid;
begin
  select id into v_delivery_id from vip_deliveries where operation_key = p_operation_key;
  if v_delivery_id is not null then return v_delivery_id; end if;
  select * into v_package from vip_packages where id = p_package_id and active = true for share;
  if not found then raise exception 'Pacote VIP indisponível.'; end if;
  if exists(select 1 from vip_memberships where server = p_server and steamid = p_steamid) then raise exception 'Este jogador já recebeu VIP neste servidor.'; end if;
  insert into vip_deliveries(operation_key,package_id,package_name,price,player_id,steamid,character_name,server,payment_date,payment_method,admin_note,created_by)
  values(p_operation_key,v_package.id,v_package.name,v_package.price,p_player_id,p_steamid,p_character_name,p_server,p_payment_date,p_payment_method,p_admin_note,p_created_by) returning id into v_delivery_id;
  insert into vip_delivery_items(delivery_id,friendly_name,prefab,quantity,quality,sort_order)
  select v_delivery_id, x.friendly_name, x.prefab, x.quantity, x.quality, x.sort_order
  from jsonb_to_recordset(p_items) as x(friendly_name text,prefab text,quantity integer,quality integer,sort_order integer);
  insert into financas(data,nick,valor,nome,tipo,observacao,server,player_id,steamid,personagem,enviado_por,categoria,forma_pagamento,vip_delivery_id)
  values(p_payment_date,p_character_name,v_package.price,v_package.name,'VIP',p_admin_note,p_server,p_player_id,p_steamid,p_character_name,p_created_by,'VIP',p_payment_method,v_delivery_id) returning id into v_financial_id;
  update vip_deliveries set financial_id = v_financial_id where id = v_delivery_id;
  insert into vip_memberships(server,steamid,character_name,player_id,delivery_id) values(p_server,p_steamid,p_character_name,p_player_id,v_delivery_id);
  insert into security_logs(action,user_email,performed_by,details) values('vip_delivery_created',p_created_by,p_created_by,jsonb_build_object('delivery_id',v_delivery_id,'server',p_server,'steamid',p_steamid)::text);
  return v_delivery_id;
end $$;
revoke all on function public.create_vip_delivery(uuid,uuid,uuid,text,text,text,timestamptz,text,text,text,jsonb) from public;
grant execute on function public.create_vip_delivery(uuid,uuid,uuid,text,text,text,timestamptz,text,text,text,jsonb) to service_role;
