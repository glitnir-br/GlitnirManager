alter table public.server_mod_manifests add column if not exists package_key text not null default '';
alter table public.server_mod_manifests add column if not exists folder_name text not null default '';
alter table public.server_mod_manifests add column if not exists manifest_valid boolean not null default true;
create index if not exists server_mod_manifests_package_idx on public.server_mod_manifests (package_key);
