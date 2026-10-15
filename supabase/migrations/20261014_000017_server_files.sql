create table if not exists public.server_files (
  category text not null check (category in ('plugins', 'whitelist', 'greylist')),
  path text not null,
  is_directory boolean not null default false,
  size bigint not null default 0,
  servers text[] not null default '{}',
  primary key (category, path)
);
create table if not exists public.server_file_syncs (
  category text primary key check (category in ('plugins', 'whitelist', 'greylist')),
  synced_at timestamptz not null
);
alter table public.server_files enable row level security;
alter table public.server_file_syncs enable row level security;
create policy "admin_manage_server_files" on public.server_files for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_server_file_syncs" on public.server_file_syncs for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
