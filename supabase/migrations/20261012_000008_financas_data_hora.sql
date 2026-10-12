alter table public.financas
  alter column data type timestamptz
  using data::timestamp at time zone 'America/Sao_Paulo';
