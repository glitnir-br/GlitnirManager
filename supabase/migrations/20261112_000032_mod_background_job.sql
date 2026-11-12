create table if not exists public.mod_comparison_job (
  id boolean primary key default true check (id),
  token uuid not null,
  owner text not null,
  status text not null check (status in ('running','paused','completed','cancelled','failed')),
  stage text not null,
  done integer not null default 0,
  total integer not null default 0,
  message text,
  queue jsonb not null default '[]'::jsonb,
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.mod_comparison_job enable row level security;

create or replace function public.mod_comparison_finish_job(p_token uuid, p_owner text, p_entries jsonb)
returns public.mod_comparison_snapshot language plpgsql security definer set search_path = public as $$
declare snapshot public.mod_comparison_snapshot;
begin
  perform 1 from public.mod_comparison_job where id = true and token = p_token and owner = p_owner and status = 'running' for update;
  if not found then raise exception 'Sincronização cancelada ou substituída.'; end if;
  snapshot := public.mod_comparison_finish(p_token, p_owner, p_entries);
  update public.mod_comparison_job set status = 'completed', stage = 'Concluída', queue = '[]'::jsonb, entries = '[]'::jsonb, updated_at = now() where id = true;
  return snapshot;
end $$;
revoke all on function public.mod_comparison_finish_job(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.mod_comparison_finish_job(uuid,text,jsonb) to service_role;
notify pgrst, 'reload schema';
