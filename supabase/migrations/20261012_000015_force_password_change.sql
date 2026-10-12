alter table public.user_profiles add column if not exists must_change_password boolean not null default false;
