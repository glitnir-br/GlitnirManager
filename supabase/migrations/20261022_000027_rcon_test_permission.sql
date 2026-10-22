insert into public.role_permissions (role_key, page_key, allowed)
values
  ('adm_principal', 'rcon_testes', true),
  ('administrador', 'rcon_testes', true),
  ('financeiro', 'rcon_testes', false),
  ('visitante', 'rcon_testes', false)
on conflict (role_key, page_key) do nothing;
