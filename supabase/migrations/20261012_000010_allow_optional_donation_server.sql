-- Doações são globais; o vínculo com um servidor é opcional no cadastro.
alter table public.financas alter column server drop not null;
alter table public.financas alter column server drop default;
