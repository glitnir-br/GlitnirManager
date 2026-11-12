import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrations = [
  '20260929_000001_glitnir_schema.sql', '20260929_000002_authenticated_policies.sql',
  '20260929_000003_repair_crud_policies.sql', '20261012_000004_add_server_partition.sql',
  '20261012_000007_financas_player_delivery.sql', '20261012_000010_allow_optional_donation_server.sql',
  '20261012_000011_allow_global_expenses.sql', '20261012_000012_profile_preferences.sql',
  '20261012_000015_force_password_change.sql', '20261014_000017_server_files.sql',
  '20261014_000018_server_mod_manifests.sql', '20261014_000019_mod_creator.sql',
  '20261014_000020_mod_folder_identity.sql', '20261015_000004_roles_and_permissions.sql',
  '20261018_000021_vip_packages_and_deliveries.sql', '20261018_000024_player_item_deliveries.sql',
  '20261112_000028_safe_data_reset.sql', '20261112_000029_security_hardening.sql',
  '20261112_000030_safe_sync_deliveries.sql',
];

async function database() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create role service_role;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('test.role',true),''),'authenticated') $$;
    grant usage on schema auth to authenticated, anon, service_role;
    grant execute on all functions in schema auth to authenticated, anon, service_role;`);
  for (const file of migrations) {
    const sql = (await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8')).replace('create extension if not exists pgcrypto;', '');
    try { await db.exec(sql); } catch (error) { throw new Error(`${file}: ${error.message}`, { cause: error }); }
  }
  await db.exec("select set_config('test.role', 'service_role', false)");
  await db.exec(`insert into public.user_profiles(email,role,status) values
    ('principal@example.test','adm_principal','ativo'), ('admin@example.test','administrador','ativo'),
    ('blocked@example.test','administrador','bloqueado'), ('finance@example.test','financeiro','ativo');`);
  await db.exec("select set_config('test.role', 'authenticated', false)");
  return db;
}
async function login(db, email) {
  await db.exec('reset role');
  await db.query("select set_config('test.jwt', $1, false)", [JSON.stringify({ email })]);
  await db.exec('set role authenticated');
}

test('perfis principais e usuários bloqueados são protegidos; acesso financeiro respeita permissões', async (t) => {
  const db = await database(); t.after(() => db.close());
  await login(db, 'admin@example.test');
  await assert.rejects(db.exec("update public.user_profiles set role='adm_principal' where email='admin@example.test'"));
  await assert.rejects(db.exec("insert into public.user_profiles(email,role,status) values ('new@example.test','adm_principal','ativo')"));
  await db.exec('reset role');
  await db.exec("insert into public.players(nick,steamid,server) values ('Teste','123','server_1')");
  await login(db, 'admin@example.test');
  assert.equal((await db.query("delete from public.players where nick='Teste' returning id")).rows.length, 0);
  await login(db, 'blocked@example.test');
  assert.equal((await db.query('select public.glitnir_is_admin() as allowed')).rows[0].allowed, false);
  assert.equal((await db.query('select count(*)::int as n from public.players')).rows[0].n, 0);
  await login(db, 'finance@example.test');
  assert.equal((await db.query('select public.glitnir_can_access_finance() as allowed')).rows[0].allowed, true);
  await db.exec('reset role');
  await db.exec("insert into public.role_permissions(role_key,page_key,allowed) values ('financeiro','financeiro',false)");
  await login(db, 'finance@example.test');
  assert.equal((await db.query('select public.glitnir_can_access_finance() as allowed')).rows[0].allowed, false);
});

test('reset transacional respeita servidor, preserva VIP e reverte erros', async (t) => {
  const db = await database(); t.after(() => db.close());
  const f1 = '00000000-0000-0000-0000-000000000001'; const f2 = '00000000-0000-0000-0000-000000000002';
  const vip = '00000000-0000-0000-0000-000000000003';
  await db.query("insert into public.financas(id,server,valor) values ($1,'server_1',1),($2,'server_2',2)", [f1, f2]);
  await db.query("insert into public.vip_deliveries(id,operation_key,package_name,price,steamid,character_name,server,payment_date,created_by,financial_id) values ($1,gen_random_uuid(),'VIP',1,'1','jogador','server_1',now(),'test',$2)", [vip, f1]);
  await login(db, 'admin@example.test');
  await assert.rejects(db.query('select public.reset_system_data($1,$2)', ['server_1', JSON.stringify({ financas: [f1] })]));
  await login(db, 'principal@example.test');
  await assert.rejects(db.query('select public.reset_system_data($1,$2)', ['server_1', JSON.stringify({ financas: [f1, f2] })]));
  assert.equal((await db.query('select count(*)::int as n from public.financas')).rows[0].n, 2);
  const result = await db.query('select public.reset_system_data($1,$2) as result', ['server_1', JSON.stringify({ financas: [f1] })]);
  assert.equal(result.rows[0].result.total, 1);
  await db.exec('reset role');
  assert.equal((await db.query('select financial_id from public.vip_deliveries where id=$1', [vip])).rows[0].financial_id, null);
  assert.equal((await db.query('select count(*)::int as n from public.financas')).rows[0].n, 1);
});

test('substituição do inventário reverte em caso de erro', async (t) => {
  const db = await database(); t.after(() => db.close());
  await db.exec("insert into public.server_files(category,path,is_directory,size,servers) values ('plugins','antigo',false,1,array['server_1'])");
  await assert.rejects(db.query('select public.replace_server_file_inventory($1,$2)', ['plugins', JSON.stringify([{ path: null, is_directory: false, size: 1, servers: [] }])]));
  assert.equal((await db.query('select path from public.server_files')).rows[0].path, 'antigo');
});

test('somente um envio não conferido por jogador e prefab é permitido', async (t) => {
  const db = await database(); t.after(() => db.close());
  const insert = `insert into public.player_item_deliveries(operation_key,steamid,character_name,server,friendly_name,prefab,quantity,quality,status,command,created_by)
    values (gen_random_uuid(),'76561190000000000','jogador','server_1','Item','Teste',1,1,$1,'comando','test')`;
  await db.query(insert, ['em_processamento']);
  await assert.rejects(db.query(insert, ['em_processamento']), { code: '23505' });
  await db.exec("update public.player_item_deliveries set status='resultado_incerto'");
  await assert.rejects(db.query(insert, ['em_processamento']), { code: '23505' });
  await db.exec("update public.player_item_deliveries set status='verificada_nao_entregue'");
  await db.query(insert, ['em_processamento']);
  assert.equal((await db.query('select count(*)::int as n from public.player_item_deliveries')).rows[0].n, 2);
});
