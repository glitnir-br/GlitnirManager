alter table public.vip_memberships
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by text,
  add column if not exists revocation_reason text;

create index if not exists vip_memberships_active_idx
  on public.vip_memberships (server, active, created_at desc);

notify pgrst, 'reload schema';
