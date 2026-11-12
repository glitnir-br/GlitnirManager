-- A exclusão em lote é restrita ao ADM Principal também no banco.
create or replace function public.glitnir_is_active_principal() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_profiles
    where email = auth.jwt() ->> 'email' and role = 'adm_principal'
      and status in ('ativo', 'aprovado'))
$$;

do $$
declare t text;
begin
  foreach t in array array['players','financas','compras','despesas','banidos','security_logs'] loop
    execute format('drop policy if exists %I on public.%I', 'admin_manage_' || t, t);
    execute format('create policy %I on public.%I for select to authenticated using (public.glitnir_is_admin())', 'reset_read_' || t, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.glitnir_is_admin())', 'reset_insert_' || t, t);
    execute format('create policy %I on public.%I for update to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin())', 'reset_update_' || t, t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.glitnir_is_active_principal())', 'reset_delete_' || t, t);
  end loop;
end $$;

create or replace function public.reset_system_data(p_target text, p_records jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  category text; ids uuid[]; expected integer; affected integer; total integer := 0;
  counts jsonb := '{}'::jsonb; server_scoped boolean;
begin
  if not public.glitnir_is_active_principal() then raise exception 'Apenas o ADM Principal ativo pode resetar dados.'; end if;
  if p_target is null or p_target not in ('server_1','server_2','todos') then raise exception 'Servidor inválido.'; end if;
  if p_records is null or jsonb_typeof(p_records) <> 'object' or p_records = '{}'::jsonb then raise exception 'Seleção inválida.'; end if;
  for category in select jsonb_object_keys(p_records) loop
    if category not in ('financas','compras','despesas','players','banidos','security_logs') then raise exception 'Categoria inválida: %', category; end if;
    if jsonb_typeof(p_records -> category) <> 'array' then raise exception 'Lista de registros inválida.'; end if;
    server_scoped := category not in ('despesas','security_logs');
    if not server_scoped and p_target <> 'todos' then raise exception 'A categoria % é global.', category; end if;
    select coalesce(array_agg(value::uuid), array[]::uuid[]), count(*) into ids, expected
      from jsonb_array_elements_text(p_records -> category);
    if expected <> (select count(distinct x) from unnest(ids) as x) then raise exception 'Registros duplicados em %.', category; end if;
    if category = 'financas' then
      update public.vip_deliveries v set financial_id = null where v.financial_id = any(ids)
        and exists (select 1 from public.financas f where f.id = v.financial_id and (p_target = 'todos' or f.server = p_target));
    end if;
    if server_scoped then
      execute format('delete from public.%I where id = any($1) and ($2 = ''todos'' or server = $2)', category) using ids, p_target;
    else
      execute format('delete from public.%I where id = any($1)', category) using ids;
    end if;
    get diagnostics affected = row_count;
    if affected <> expected then raise exception 'Os dados de % mudaram desde o backup; gere um novo backup.', category; end if;
    total := total + affected;
    counts := counts || jsonb_build_object(category, affected);
  end loop;
  insert into public.security_logs(action, user_email, performed_by, details)
    values ('data_reset', auth.jwt() ->> 'email', auth.jwt() ->> 'email', jsonb_build_object('servidor', p_target, 'contagens', counts)::text);
  return jsonb_build_object('total', total, 'counts', counts);
end $$;
revoke all on function public.reset_system_data(text,jsonb) from public, anon;
grant execute on function public.reset_system_data(text,jsonb) to authenticated;
notify pgrst, 'reload schema';
