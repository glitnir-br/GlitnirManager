create table if not exists public.atelier_artworks (
  name text primary key,
  servers text[] not null default '{}',
  size bigint not null default 0,
  storage_path text not null,
  synced_at timestamptz not null default now()
);

alter table public.atelier_artworks enable row level security;

drop policy if exists "admin_manage_atelier_artworks" on public.atelier_artworks;
create policy "admin_manage_atelier_artworks" on public.atelier_artworks
  for all to authenticated
  using (public.glitnir_is_admin())
  with check (public.glitnir_is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('atelier-artwork', 'atelier-artwork', false, 8388608, array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'])
on conflict (id) do nothing;
