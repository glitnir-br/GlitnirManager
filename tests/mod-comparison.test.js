import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMods } from '../src/lib/modComparison.js';
import handler from '../api/mod-comparison.js';
import { initialModTasks, processModTask, runModSync } from '../src/lib/modSyncWorker.js';

const entry = (server, category, folder, version) => ({ server, category, folder, name: folder, version, status: 'ok' });
test('compara cada lista com Plugins no mesmo servidor', () => {
  const result = compareMods([
    entry('server_1', 'plugins', 'Autor-Mod', '1.0'), entry('server_1', 'whitelist', 'autor-mod', '1.0'),
    entry('server_1', 'greylist', 'Autor-Mod', '1.1'), entry('server_2', 'plugins', 'Autor-Mod', '2.0'),
    entry('server_2', 'whitelist', 'Autor-Mod', '2.0'), entry('server_2', 'greylist', 'Autor-Mod', '2.0'),
  ]);
  const mod = result[0];
  assert.equal(mod.divergent, true);
  assert.equal(mod.servers.server_1.status, 'mismatch');
  assert.deepEqual(mod.servers.server_1.details.map(({ label, tone, entry: item }) => [label, tone, item.version]), [
    ['Plugins', 'reference', '1.0'], ['Whitelist', 'match', '1.0'], ['Greylist', 'mismatch', '1.1'],
  ]);
  assert.equal(mod.servers.server_2.status, 'match');
  assert.equal(mod.servers.server_2.issue, false);
});

test('um servidor sem o mod é neutro e versões iguais não geram aviso', () => {
  const mod = compareMods([entry('server_1', 'plugins', 'A', '1'), entry('server_1', 'whitelist', 'A', '1')])[0];
  assert.equal(mod.divergent, false);
  assert.equal(mod.servers.server_1.status, 'match');
  assert.equal(mod.servers.server_2.status, 'absent');
});

test('identifica ausências de Plugins e das listas sem esconder versões', () => {
  const plugin = compareMods([entry('server_1', 'plugins', 'A', '1')])[0].servers.server_1;
  assert.ok(plugin.labels.includes('Ausente na Whitelist e Greylist'));
  assert.equal(plugin.details[0].entry.version, '1');
  const list = compareMods([entry('server_1', 'greylist', 'A', '2')])[0].servers.server_1;
  assert.ok(list.labels.includes('Ausente em Plugins'));
  assert.equal(list.details[0].tone, 'extra');
  assert.equal(list.details[0].entry.version, '2');
});

test('versões indisponíveis não são consideradas iguais ou diferentes', () => {
  for (const status of ['missing', 'invalid', 'incomplete', 'file']) {
    for (const category of ['plugins', 'whitelist']) {
      const entries = [entry('server_1', 'plugins', 'A', '1'), entry('server_1', 'whitelist', 'A', '1')];
      Object.assign(entries.find((item) => item.category === category), { status, version: '' });
      const server = compareMods(entries)[0].servers.server_1;
      assert.equal(server.status, 'unknown');
      assert.equal(server.details[1].tone, 'unknown');
      assert.ok(server.labels.includes('Versão indisponível para comparação'));
    }
  }
});

test('mostra divergência e versão indisponível em listas distintas', () => {
  const mod = compareMods([
    entry('server_1', 'plugins', 'A', '1'), entry('server_1', 'whitelist', 'A', '2'),
    { ...entry('server_1', 'greylist', 'A', ''), status: 'missing' },
  ])[0];
  const server = mod.servers.server_1;
  assert.equal(server.status, 'mismatch');
  assert.ok(server.labels.includes('Versões diferentes'));
  assert.ok(server.labels.includes('Versão indisponível para comparação'));
  assert.deepEqual(server.details.map((item) => item.tone), ['reference', 'mismatch', 'unknown']);
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
