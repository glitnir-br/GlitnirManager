-- Reaplica políticas de CRUD para administradores autenticados.
-- Execute após 20260929_000001 e 20260929_000002.
drop policy if exists "admin_manage_players" on public.players;
drop policy if exists "admin_manage_financas" on public.financas;
drop policy if exists "admin_manage_compras" on public.compras;
drop policy if exists "admin_manage_despesas" on public.despesas;
drop policy if exists "admin_manage_banidos" on public.banidos;
drop policy if exists "admin_manage_gc_tabelas" on public.gc_tabelas;
drop policy if exists "admin_manage_access_requests" on public.access_requests;
drop policy if exists "admin_manage_admin_settings" on public.admin_settings;
drop policy if exists "admin_manage_security_logs" on public.security_logs;
drop policy if exists "self_or_admin_profiles" on public.user_profiles;
drop policy if exists "admin_manage_profiles" on public.user_profiles;
drop policy if exists "admin_update_profiles" on public.user_profiles;

create policy "admin_manage_players" on public.players for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_financas" on public.financas for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_compras" on public.compras for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_despesas" on public.despesas for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_banidos" on public.banidos for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_gc_tabelas" on public.gc_tabelas for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_access_requests" on public.access_requests for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_admin_settings" on public.admin_settings for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "admin_manage_security_logs" on public.security_logs for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
create policy "self_or_admin_profiles" on public.user_profiles for select to authenticated using (email = auth.jwt() ->> 'email' or public.glitnir_is_admin());
create policy "admin_manage_profiles" on public.user_profiles for all to authenticated using (public.glitnir_is_admin()) with check (public.glitnir_is_admin());
