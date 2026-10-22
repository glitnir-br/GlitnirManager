insert into public.role_permissions (role_key, page_key, allowed)
values
  ('adm_principal', 'territorios', true),
  ('administrador', 'territorios', true),
  ('financeiro', 'territorios', false),
  ('visitante', 'territorios', false)
on conflict (role_key, page_key) do nothing;
