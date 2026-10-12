update public.user_profiles
set role = 'visitante'
where role in ('moderador', 'suporte');

update public.access_requests
set role = 'visitante'
where role in ('moderador', 'suporte');
