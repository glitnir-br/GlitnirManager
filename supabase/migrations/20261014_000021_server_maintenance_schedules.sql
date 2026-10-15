create table if not exists public.server_maintenance_schedules (
  server text primary key check (server in ('server_1', 'server_2')),
  started_at timestamptz not null,
  effective_at timestamptz not null,
  created_by text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'active'))
);

alter table public.server_maintenance_schedules enable row level security;

create policy "authenticated_read_server_maintenance_schedules"
  on public.server_maintenance_schedules for select to authenticated
  using (true);

create policy "admin_manage_server_maintenance_schedules"
  on public.server_maintenance_schedules for all to authenticated
  using (public.glitnir_is_admin())
  with check (public.glitnir_is_admin());
