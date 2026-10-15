create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(), key text not null unique, name text not null,
  created_by text, created_date timestamptz not null default now(), updated_at timestamptz
);
create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(), role_key text not null, page_key text not null,
  allowed boolean not null default false, created_date timestamptz not null default now(), unique(role_key, page_key)
);
insert into public.roles (key, name) values ('adm_principal', 'ADM Principal'), ('administrador', 'Administrador'), ('financeiro', 'Financeiro'), ('visitante', 'Visitante') on conflict (key) do nothing;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
create or replace function public.glitnir_is_principal() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_profiles where email = auth.jwt() ->> 'email' and role = 'adm_principal') $$;
create policy "authenticated_read_roles" on public.roles for select to authenticated using (true);
create policy "principal_manage_roles" on public.roles for all to authenticated using (public.glitnir_is_principal()) with check (public.glitnir_is_principal());
create policy "authenticated_read_role_permissions" on public.role_permissions for select to authenticated using (true);
create policy "principal_manage_role_permissions" on public.role_permissions for all to authenticated using (public.glitnir_is_principal()) with check (public.glitnir_is_principal());
