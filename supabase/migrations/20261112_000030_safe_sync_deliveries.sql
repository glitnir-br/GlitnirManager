create or replace function public.replace_server_file_inventory(p_category text, p_files jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_category not in ('plugins','whitelist','greylist') or jsonb_typeof(p_files) <> 'array' then raise exception 'Inventário inválido.'; end if;
  perform pg_advisory_xact_lock(hashtext('server_files:' || p_category));
  delete from public.server_files where category = p_category;
  insert into public.server_files(category, path, is_directory, size, servers)
    select p_category, x.path, x.is_directory, x.size, x.servers
    from jsonb_to_recordset(p_files) as x(path text, is_directory boolean, size bigint, servers text[]);
  insert into public.server_file_syncs(category, synced_at) values (p_category, now())
    on conflict (category) do update set synced_at = excluded.synced_at;
end $$;
create or replace function public.replace_server_mod_manifests(p_records jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_records) <> 'array' then raise exception 'Inventário inválido.'; end if;
  perform pg_advisory_xact_lock(hashtext('server_mod_manifests'));
  delete from public.server_mod_manifests;
  insert into public.server_mod_manifests(package_key, folder_name, name, version, creator, category, server, manifest_path, manifest_valid)
    select x.package_key, x.folder_name, x.name, x.version, x.creator, x.category, x.server, x.manifest_path, x.manifest_valid
    from jsonb_to_recordset(p_records) as x(package_key text, folder_name text, name text, version text, creator text, category text, server text, manifest_path text, manifest_valid boolean);
end $$;
revoke all on function public.replace_server_file_inventory(text,jsonb), public.replace_server_mod_manifests(jsonb) from public, anon, authenticated;
grant execute on function public.replace_server_file_inventory(text,jsonb), public.replace_server_mod_manifests(jsonb) to service_role;

alter table public.player_item_deliveries drop constraint if exists player_item_deliveries_status_check;
alter table public.player_item_deliveries add constraint player_item_deliveries_status_check
  check (status in ('em_processamento','entregue','falhou','resultado_incerto','verificada_entregue','verificada_nao_entregue'));
create unique index if not exists player_item_deliveries_one_unresolved
  on public.player_item_deliveries(server, steamid, prefab)
  where status in ('em_processamento','resultado_incerto');
notify pgrst, 'reload schema';
