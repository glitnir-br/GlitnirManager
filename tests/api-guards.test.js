import test from 'node:test';
import assert from 'node:assert/strict';
import createAccess from '../api/create-access-user.js';
import serverFiles from '../api/server-files.js';

const originalFetch = globalThis.fetch;
function response() { return { statusCode: 0, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function mockAuth() {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return Response.json({ id: '00000000-0000-0000-0000-000000000001', email: 'admin@example.test' });
    if (url.includes('/rest/v1/user_profiles')) return Response.json([{ role: 'administrador', status: 'ativo' }]);
    if (url.startsWith('https://ptero.example.test/')) return new Response('indisponível', { status: 503 });
    throw new Error(`Requisição inesperada: ${url}`);
  };
}
test.beforeEach(() => {
  process.env.SUPABASE_URL = 'https://supabase.example.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  process.env.PTERODACTYL_URL = 'https://ptero.example.test'; process.env.PTERODACTYL_API_KEY = 'test-key'; process.env.PTERODACTYL_SERVER_1_ID = 'server-id';
  mockAuth();
});
test.afterEach(() => { globalThis.fetch = originalFetch; });

test('administrador não consegue criar ADM Principal pela API', async () => {
  const res = response();
  await createAccess({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { email: 'new@example.test', role: 'adm_principal' } }, res);
  assert.equal(res.statusCode, 403);
});
test('falha no Pterodactyl não aparece como lista vazia de territórios', async () => {
  const res = response();
  await serverFiles({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { action: 'territory-list', server: 'server_1' } }, res);
  assert.equal(res.statusCode, 500);
  assert.match(res.body.error, /Pterodactyl respondeu 503/);
  assert.equal(res.body.files, undefined);
});
