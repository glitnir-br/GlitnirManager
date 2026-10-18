alter table public.vip_memberships
  add column if not exists eligibility_released_at timestamptz,
  add column if not exists eligibility_released_by text,
  add column if not exists eligibility_release_reason text;

alter table public.vip_memberships
  drop constraint if exists vip_memberships_server_steamid_key;

create unique index if not exists vip_memberships_current_server_steamid_idx
  on public.vip_memberships (server, steamid)
  where eligibility_released_at is null;

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
  if exists(select 1 from vip_memberships where server = p_server and steamid = p_steamid and eligibility_released_at is null) then raise exception 'Este jogador já recebeu VIP neste servidor.'; end if;
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

notify pgrst, 'reload schema';
