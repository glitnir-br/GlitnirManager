-- Separa os dados operacionais entre os dois servidores do Glitnir.
-- Todo o histórico anterior passa a pertencer ao Server 1.
alter table public.players add column if not exists server text;
alter table public.financas add column if not exists server text;
alter table public.compras add column if not exists server text;
alter table public.despesas add column if not exists server text;
alter table public.banidos add column if not exists server text;
alter table public.gc_tabelas add column if not exists server text;

update public.players set server = 'server_1' where server is null;
update public.financas set server = 'server_1' where server is null;
update public.compras set server = 'server_1' where server is null;
update public.despesas set server = 'server_1' where server is null;
update public.banidos set server = 'server_1' where server is null;
update public.gc_tabelas set server = 'server_1' where server is null;

alter table public.players alter column server set default 'server_1';
alter table public.financas alter column server set default 'server_1';
alter table public.compras alter column server set default 'server_1';
alter table public.despesas alter column server set default 'server_1';
alter table public.banidos alter column server set default 'server_1';
alter table public.gc_tabelas alter column server set default 'server_1';

alter table public.players alter column server set not null;
alter table public.financas alter column server set not null;
alter table public.compras alter column server set not null;
alter table public.despesas alter column server set not null;
alter table public.banidos alter column server set not null;
alter table public.gc_tabelas alter column server set not null;

alter table public.players drop constraint if exists players_server_check;
alter table public.financas drop constraint if exists financas_server_check;
alter table public.compras drop constraint if exists compras_server_check;
alter table public.despesas drop constraint if exists despesas_server_check;
alter table public.banidos drop constraint if exists banidos_server_check;
alter table public.gc_tabelas drop constraint if exists gc_tabelas_server_check;

alter table public.players add constraint players_server_check check (server in ('server_1', 'server_2'));
alter table public.financas add constraint financas_server_check check (server in ('server_1', 'server_2'));
alter table public.compras add constraint compras_server_check check (server in ('server_1', 'server_2'));
alter table public.despesas add constraint despesas_server_check check (server in ('server_1', 'server_2'));
alter table public.banidos add constraint banidos_server_check check (server in ('server_1', 'server_2'));
alter table public.gc_tabelas add constraint gc_tabelas_server_check check (server in ('server_1', 'server_2'));

create index if not exists players_server_idx on public.players (server);
create index if not exists financas_server_idx on public.financas (server);
create index if not exists compras_server_idx on public.compras (server);
create index if not exists despesas_server_idx on public.despesas (server);
create index if not exists banidos_server_idx on public.banidos (server);
create index if not exists gc_tabelas_server_idx on public.gc_tabelas (server);
