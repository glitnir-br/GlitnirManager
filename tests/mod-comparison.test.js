import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMods } from '../src/lib/modComparison.js';
import handler from '../api/mod-comparison.js';
import { initialModTasks, processModTask, runModSync } from '../src/lib/modSyncWorker.js';

const entry = (server, category, folder, version) => ({ server, category, folder, name: folder, version, status: 'ok' });
test('compara versões dentro de cada categoria sem confundir os servidores', () => {
  const result = compareMods([
    entry('server_1', 'plugins', 'Autor-Mod', '1.0'), entry('server_2', 'plugins', 'autor-mod', '2.0'),
    entry('server_1', 'whitelist', 'Autor-Mod', '1.0'), entry('server_2', 'whitelist', 'Autor-Mod', '1.0'),
    entry('server_1', 'greylist', 'Outro', '1.0'),
  ]);
  const mod = result.find((item) => item.key === 'autor-mod');
  assert.equal(mod.divergent, true);
  assert.equal(mod.cells['server_1:whitelist'].version, '1.0');
  assert.equal(mod.cells['server_2:plugins'].version, '2.0');
  assert.equal(result.find((item) => item.key === 'outro').divergent, true);
  assert.equal(compareMods([entry('server_1', 'plugins', 'A', '1'), entry('server_2', 'plugins', 'A', '1')])[0].divergent, false);
});

function response() { return { statusCode: 0, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
const savedFetch = globalThis.fetch;
test.beforeEach(() => {
  process.env.SUPABASE_URL = 'https://supabase.example.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  process.env.PTERODACTYL_URL = 'https://ptero.example.test'; process.env.PTERODACTYL_API_KEY = 'test-key'; process.env.PTERODACTYL_SERVER_1_ID = 'test-server';
});
test.afterEach(() => { globalThis.fetch = savedFetch; });
function fakeFetch(pteroResponse) {
  return async (input) => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return Response.json({ id: '00000000-0000-0000-0000-000000000001', email: 'admin@example.test' });
    if (url.includes('/rest/v1/user_profiles')) return Response.json([{ role: 'administrador', status: 'ativo' }]);
    if (url.includes('/rest/v1/role_permissions')) return Response.json([{ page_key: 'mods', allowed: true }]);
    if (url.includes('/rest/v1/rpc/mod_comparison_touch')) return Response.json(true);
    if (url.startsWith('https://ptero.example.test/')) return pteroResponse(url);
    throw new Error(`Requisição inesperada: ${url}`);
  };
}
const req = (body) => ({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { token: '00000000-0000-0000-0000-000000000001', ...body } });

test('lê o manifest do diretório solicitado e devolve versão exata', async () => {
  const calls = [];
  globalThis.fetch = fakeFetch((url) => {
    calls.push(url);
    if (url.includes('/files/list?')) return Response.json({ data: [{ attributes: { name: 'manifest.json', is_file: true } }] });
    return new Response(JSON.stringify({ name: 'Mod A', version_number: '2.3.4' }));
  });
  const res = response();
  await handler(req({ action: 'manifest', server: 'server_1', category: 'whitelist', folder: 'Autor-Mod' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.entry.version, '2.3.4');
  assert.equal(res.body.entry.status, 'ok');
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => decodeURIComponent(url).includes('/AzuAntiCheat/Whitelist/Autor-Mod')));
});
test('pasta sem manifest é identificada e não inventa versão', async () => {
  globalThis.fetch = fakeFetch(() => Response.json({ data: [] }));
  const res = response();
  await handler(req({ action: 'manifest', server: 'server_1', category: 'greylist', folder: 'Mod' }), res);
  assert.equal(res.body.entry.status, 'missing');
  assert.equal(res.body.entry.version, '');
});
test('permite consultar subpastas sem sair da pasta do mod', async () => {
  globalThis.fetch = fakeFetch((url) => {
    assert.ok(decodeURIComponent(url).includes('/BepInEx/plugins/Autor-Mod/config'));
    return Response.json({ data: [{ attributes: { name: 'interno', is_file: false } }] });
  });
  const res = response();
  await handler(req({ action: 'manifest', server: 'server_1', category: 'plugins', folder: 'Autor-Mod', relativePath: 'config' }), res);
  assert.deepEqual(res.body.subfolders, ['interno']);
  assert.equal(res.body.entry.folder, 'Autor-Mod');
});
test('limite de requisições é propagado sem substituir resultados por pasta vazia', async () => {
  globalThis.fetch = fakeFetch(() => new Response('', { status: 429, headers: { 'Retry-After': '5' } }));
  const res = response();
  await handler(req({ action: 'root', server: 'server_1', category: 'plugins' }), res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['Retry-After'], '5');
  assert.equal(res.body.entries, undefined);
});
test('rejeita caminhos fora da pasta selecionada', async () => {
  globalThis.fetch = fakeFetch(() => { throw new Error('Pterodactyl não deve ser chamado'); });
  const res = response();
  await handler(req({ action: 'manifest', server: 'server_1', category: 'plugins', folder: '../outro' }), res);
  assert.equal(res.statusCode, 400);
  const nested = response();
  await handler(req({ action: 'manifest', server: 'server_1', category: 'plugins', folder: 'Mod', relativePath: '../../fora' }), nested);
  assert.equal(nested.statusCode, 400);
});
test('abrir a tela carrega somente o resultado salvo, sem consultar o Pterodactyl', async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return Response.json({ id: '00000000-0000-0000-0000-000000000001', email: 'admin@example.test' });
    if (url.includes('/rest/v1/user_profiles')) return Response.json([{ role: 'administrador', status: 'ativo' }]);
    if (url.includes('/rest/v1/role_permissions')) return Response.json([{ page_key: 'mods', allowed: true }]);
    if (url.includes('/rest/v1/mod_comparison_snapshot')) return Response.json([{ entries: [], synced_at: '2026-01-01T00:00:00Z', synced_by: 'admin@example.test' }]);
    if (url.includes('/rest/v1/mod_comparison_job')) return Response.json([]);
    throw new Error(`Consulta inesperada: ${url}`);
  };
  const res = response();
  await handler(req({ action: 'get' }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.snapshot.entries, []);
});
test('consulta o manifest diretamente sem listar toda a árvore do mod', async () => {
  const calls = [];
  const result = await processModTask({ type: 'folder', server: 'server_1', category: 'plugins', folder: 'Autor-Mod' }, async (server, path) => {
    calls.push(path);
    return JSON.stringify({ name: 'Mod', version_number: '2.4' });
  });
  assert.equal(calls.length, 1);
  assert.match(decodeURIComponent(calls[0]), /Autor-Mod\/manifest\.json/);
  assert.equal(result.entries[0].version, '2.4');
});
test('a fila executa e salva progresso sem depender de uma aba aberta', async () => {
  const snapshots = []; let finished = false;
  const admin = {
    from() { return { update(values) { snapshots.push(structuredClone(values)); return this; }, eq() { return this; }, select() { return this; }, async maybeSingle() { return { data: { status: 'running' }, error: null }; } }; },
    async rpc(name, args) { if (name === 'mod_comparison_touch') return { data: true }; if (name === 'mod_comparison_finish_job') { finished = true; assert.equal(args.p_entries.length, 1); } return { data: null, error: null }; },
  };
  const ptero = async (server, path) => path.includes('/files/list') ? { data: [{ attributes: { name: 'Mod', is_file: false } }] } : JSON.stringify({ name: 'Mod', version_number: '1' });
  await runModSync({ admin, token: 'token', owner: 'admin', queue: [initialModTasks()[0]], entries: [], ptero, pause: async () => {} });
  assert.ok(finished);
  assert.ok(snapshots.some((snapshot) => snapshot.done === 2));
});
test('limite de tempo pausa a fila sem descartar as tarefas pendentes', async () => {
  const saved = []; let published = false;
  const admin = {
    from() { return { update(values) { saved.push(structuredClone(values)); return this; }, eq() { return this; }, select() { return this; }, async maybeSingle() { return { data: { status: 'running' }, error: null }; } }; },
    async rpc(name) { if (name === 'mod_comparison_touch') return { data: true }; if (name === 'mod_comparison_finish_job') published = true; return { data: null, error: null }; },
  };
  await runModSync({ admin, token: 'token', owner: 'admin', queue: [initialModTasks()[0]], entries: [], ptero: async () => { throw new Error('não deveria consultar'); }, now: () => 0, budgetMs: 1000, pause: async () => {} });
  const paused = saved.find((state) => state.status === 'paused');
  assert.equal(paused.queue.length, 1);
  assert.equal(paused.done, 0);
  assert.equal(published, false);
});
