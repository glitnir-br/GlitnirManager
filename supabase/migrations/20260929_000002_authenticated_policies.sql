grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

create or replace function public.glitnir_is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_profiles where email = auth.jwt() ->> 'email' and role in ('adm_principal', 'administrador')) $$;

create policy "admin_manage_players" on public.players for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_financas" on public.financas for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_compras" on public.compras for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_despesas" on public.despesas for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_banidos" on public.banidos for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_gc_tabelas" on public.gc_tabelas for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "self_or_admin_profiles" on public.user_profiles for select to authenticated using (email = auth.jwt() ->> 'email' or public.glitnir_is_admin());
create policy "admin_manage_profiles" on public.user_profiles for insert to authenticated with check (public.glitnir_is_admin());
create policy "admin_update_profiles" on public.user_profiles for update to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_access_requests" on public.access_requests for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_admin_settings" on public.admin_settings for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_security_logs" on public.security_logs for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
