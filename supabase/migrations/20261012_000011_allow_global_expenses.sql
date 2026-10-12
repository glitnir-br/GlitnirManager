-- Despesas são registros globais e não pertencem a um servidor específico.
alter table public.despesas alter column server drop not null;
alter table public.despesas alter column server drop default;
