create table if not exists public.mod_comparison_snapshot (
  id boolean primary key default true check (id),
  entries jsonb not null check (jsonb_typeof(entries) = 'array'),
  synced_at timestamptz not null default now(),
  synced_by text not null
);
alter table public.mod_comparison_snapshot enable row level security;
create table if not exists public.mod_comparison_lock (
  id boolean primary key default true check (id),
  token uuid not null,
  owner text not null,
  expires_at timestamptz not null
);
alter table public.mod_comparison_lock enable row level security;

create or replace function public.mod_comparison_acquire(p_owner text) returns uuid
language plpgsql security definer set search_path = public as $$
declare result uuid; candidate uuid := gen_random_uuid();
begin
  insert into public.mod_comparison_lock(id, token, owner, expires_at) values (true, candidate, p_owner, now() + interval '2 minutes')
  on conflict (id) do update set token = excluded.token, owner = excluded.owner, expires_at = excluded.expires_at
    where public.mod_comparison_lock.expires_at < now()
  returning token into result;
  return result;
end $$;
create or replace function public.mod_comparison_touch(p_token uuid, p_owner text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.mod_comparison_lock set expires_at = now() + interval '2 minutes'
    where id = true and token = p_token and owner = p_owner and expires_at > now();
  return found;
end $$;
create or replace function public.mod_comparison_release(p_token uuid, p_owner text) returns void
language sql security definer set search_path = public as $$
  delete from public.mod_comparison_lock where id = true and token = p_token and owner = p_owner
$$;
create or replace function public.mod_comparison_finish(p_token uuid, p_owner text, p_entries jsonb)
returns public.mod_comparison_snapshot language plpgsql security definer set search_path = public as $$
declare result public.mod_comparison_snapshot;
begin
  perform 1 from public.mod_comparison_lock where id = true and token = p_token and owner = p_owner and expires_at > now() for update;
  if not found then raise exception 'A sincronização expirou ou foi encerrada.'; end if;
  insert into public.mod_comparison_snapshot(id, entries, synced_at, synced_by) values (true, p_entries, now(), p_owner)
    on conflict (id) do update set entries = excluded.entries, synced_at = excluded.synced_at, synced_by = excluded.synced_by
    returning * into result;
  delete from public.mod_comparison_lock where id = true and token = p_token and owner = p_owner;
  return result;
end $$;
revoke all on function public.mod_comparison_acquire(text), public.mod_comparison_touch(uuid,text), public.mod_comparison_release(uuid,text), public.mod_comparison_finish(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.mod_comparison_acquire(text), public.mod_comparison_touch(uuid,text), public.mod_comparison_release(uuid,text), public.mod_comparison_finish(uuid,text,jsonb) to service_role;

insert into public.role_permissions (role_key, page_key, allowed)
select defaults.role_key, 'mods', defaults.allowed
from (values ('administrador', true), ('financeiro', false), ('visitante', false)) as defaults(role_key, allowed)
where exists (select 1 from public.role_permissions existing where existing.role_key = defaults.role_key)
on conflict (role_key, page_key) do nothing;
notify pgrst, 'reload schema';
