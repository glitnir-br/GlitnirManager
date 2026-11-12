create or replace function public.glitnir_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_profiles where email = auth.jwt() ->> 'email'
    and role in ('adm_principal', 'administrador') and status in ('ativo', 'aprovado'))
$$;
create or replace function public.glitnir_is_principal() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_profiles where email = auth.jwt() ->> 'email'
    and role = 'adm_principal' and status in ('ativo', 'aprovado'))
$$;

-- Protect privileged profiles even when requests bypass the application UI.
create or replace function public.glitnir_guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare principal boolean := public.glitnir_is_principal(); actor text := auth.jwt() ->> 'email';
begin
  if auth.role() = 'service_role' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if not public.glitnir_is_admin() or (new.role = 'adm_principal' and not principal) then raise exception 'Sem permissão para criar este perfil.'; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if not public.glitnir_is_admin() or (old.role = 'adm_principal' and not principal) then raise exception 'Sem permissão para excluir este perfil.'; end if;
    return old;
  end if;
  if not principal and (old.role = 'adm_principal' or new.role = 'adm_principal') then
    if actor <> old.email or (to_jsonb(new) - array['full_name','notification_preferences','timezone','locale','updated_at','must_change_password','two_fa_enabled','backup_codes']) is distinct from (to_jsonb(old) - array['full_name','notification_preferences','timezone','locale','updated_at','must_change_password','two_fa_enabled','backup_codes']) then
      raise exception 'Perfil principal protegido.';
    end if;
  elsif not public.glitnir_is_admin() then
    if actor is distinct from old.email or (to_jsonb(new) - array['full_name','notification_preferences','timezone','locale','updated_at','must_change_password','two_fa_enabled','backup_codes']) is distinct from (to_jsonb(old) - array['full_name','notification_preferences','timezone','locale','updated_at','must_change_password','two_fa_enabled','backup_codes']) then
      raise exception 'Sem permissão para alterar este perfil.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists glitnir_guard_profile_trigger on public.user_profiles;
create trigger glitnir_guard_profile_trigger before insert or update or delete on public.user_profiles for each row execute function public.glitnir_guard_profile();
drop policy if exists self_update_profile on public.user_profiles;
create policy self_update_profile on public.user_profiles for update to authenticated
  using (email = auth.jwt() ->> 'email') with check (email = auth.jwt() ->> 'email');

-- The financial page permission is enforced by the database, not just the UI.
create or replace function public.glitnir_can_access_finance() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_profiles p where p.email = auth.jwt() ->> 'email'
      and p.status in ('ativo','aprovado') and (
        p.role = 'adm_principal' or coalesce(
          (select rp.allowed from public.role_permissions rp where rp.role_key = p.role and rp.page_key = 'financeiro'),
          case when exists (select 1 from public.role_permissions rp where rp.role_key = p.role) then false
            else p.role in ('administrador','financeiro') end
        )
      )
  )
$$;
do $$
declare t text;
begin
  foreach t in array array['financas','compras','despesas'] loop
    execute format('drop policy if exists %I on public.%I', 'reset_read_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'reset_insert_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'reset_update_' || t, t);
    execute format('create policy %I on public.%I for select to authenticated using (public.glitnir_can_access_finance())', 'finance_read_' || t, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.glitnir_can_access_finance())', 'finance_insert_' || t, t);
    execute format('create policy %I on public.%I for update to authenticated using (public.glitnir_can_access_finance()) with check (public.glitnir_can_access_finance())', 'finance_update_' || t, t);
  end loop;
end $$;
-- Retire senhas legadas de módulos que não são mais usados.
update public.admin_settings set admin_password = null
where setting_key in ('admin_password','password_doacoes','password_compras','password_despesas') and admin_password is not null;
notify pgrst, 'reload schema';
