alter table public.server_mod_manifests add column if not exists creator text not null default 'Não informado';
