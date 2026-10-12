alter table public.user_profiles add column if not exists notification_preferences jsonb not null default '{"security":true,"access":true}'::jsonb;
alter table public.user_profiles add column if not exists timezone text not null default 'America/Sao_Paulo';
alter table public.user_profiles add column if not exists locale text not null default 'pt-BR';
