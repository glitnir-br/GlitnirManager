create table if not exists public.server_mod_manifests (
  name text not null,
  version text not null,
  category text not null check (category in ('plugins', 'whitelist', 'greylist')),
  server text not null check (server in ('server_1', 'server_2')),
  manifest_path text not null,
  primary key (name, version, category, server, manifest_path)
);
alter table public.server_mod_manifests enable row level security;
create policy "admin_manage_server_mod_manifests" on public.server_mod_manifests for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
