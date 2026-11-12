import { createClient } from '@supabase/supabase-js';

const ROOTS = { plugins: '/BepInEx/plugins', whitelist: '/BepInEx/config/AzuAntiCheat/Whitelist', greylist: '/BepInEx/config/AzuAntiCheat/Greylist' };
const SERVERS = new Set(['server_1', 'server_2']);
const STATUSES = new Set(['ok', 'missing', 'invalid', 'file', 'incomplete']);
const send = (res, status, body) => res.status(status).json(body);
const safeName = (name) => typeof name === 'string' && name.length > 0 && name.length <= 255 && !/[\\/\x00-\x1f]/.test(name) && name !== '.' && name !== '..';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function authenticate(req) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!url || !key || !token) throw Object.assign(new Error('Autenticação ou configuração ausente.'), { status: 401 });
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email) throw Object.assign(new Error('Sessão inválida.'), { status: 401 });
  const { data: profile, error: profileError } = await admin.from('user_profiles').select('role,status').eq('email', data.user.email).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !['ativo', 'aprovado'].includes(profile.status)) throw Object.assign(new Error('Usuário sem acesso ativo.'), { status: 403 });
  const { data: permissions, error: permissionError } = await admin.from('role_permissions').select('page_key,allowed').eq('role_key', profile.role);
  if (permissionError) throw permissionError;
  const allowed = profile.role === 'adm_principal' || (permissions?.length ? permissions.some((item) => item.page_key === 'mods' && item.allowed) : profile.role === 'administrador');
  if (!allowed) throw Object.assign(new Error('Seu cargo não possui permissão para consultar mods.'), { status: 403 });
  return { admin, email: data.user.email };
}

async function ptero(server, path, text = false) {
  const base = process.env.PTERODACTYL_URL?.replace(/\/$/, '');
  const key = process.env.PTERODACTYL_API_KEY;
  const serverId = process.env[server === 'server_1' ? 'PTERODACTYL_SERVER_1_ID' : 'PTERODACTYL_SERVER_2_ID'];
  if (!base || !key || !serverId) throw Object.assign(new Error('Configuração do Pterodactyl incompleta.'), { status: 503 });
  const response = await fetch(`${base}/api/client/servers/${encodeURIComponent(serverId)}${path}`, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    const retry = Number(response.headers.get('retry-after'));
    throw Object.assign(new Error(`Pterodactyl respondeu ${response.status}.`), { status: response.status === 429 ? 429 : 502, retryAfter: Number.isFinite(retry) && retry > 0 ? Math.min(retry, 30) : 3 });
  }
  return text ? response.text() : response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  try {
    const { admin, email } = await authenticate(req);
    const { action, server, category, folder } = req.body || {};
    if (action === 'get') {
      const { data, error } = await admin.from('mod_comparison_snapshot').select('entries,synced_at,synced_by').eq('id', true).maybeSingle();
      if (error) throw error;
      return send(res, 200, { snapshot: Array.isArray(data) ? data[0] : data });
    }
    if (action === 'start') {
      const { data, error } = await admin.rpc('mod_comparison_acquire', { p_owner: email });
      if (error) throw error;
      if (!data) return send(res, 409, { error: 'Já existe uma sincronização em andamento. Aguarde sua conclusão.' });
      return send(res, 200, { token: data });
    }
    const token = req.body?.token;
    if (typeof token !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return send(res, 400, { error: 'Sincronização inválida.' });
    if (action === 'cancel') {
      const { error } = await admin.rpc('mod_comparison_release', { p_token: token, p_owner: email });
      if (error) throw error;
      return send(res, 200, { success: true });
    }
    if (action === 'save') {
      const entries = req.body?.entries;
      if (!Array.isArray(entries) || entries.length > 10000 || entries.some((item) => !item || typeof item !== 'object' || !SERVERS.has(item.server) || !Object.hasOwn(ROOTS, item.category) || !safeName(item.folder) || !STATUSES.has(item.status) || typeof item.name !== 'string' || item.name.length > 255 || typeof item.version !== 'string' || item.version.length > 100)) return send(res, 400, { error: 'Resultado da sincronização inválido.' });
      const { data, error } = await admin.rpc('mod_comparison_finish', { p_token: token, p_owner: email, p_entries: entries });
      if (error) throw error;
      return send(res, 200, { snapshot: Array.isArray(data) ? data[0] : data });
    }
    if (!SERVERS.has(server) || !Object.hasOwn(ROOTS, category)) return send(res, 400, { error: 'Servidor ou pasta inválida.' });
    const { data: active, error: lockError } = await admin.rpc('mod_comparison_touch', { p_token: token, p_owner: email });
    if (lockError) throw lockError;
    if (!active) return send(res, 409, { error: 'A sincronização expirou ou foi encerrada.' });
    const root = ROOTS[category];
    if (action === 'root') {
      const listing = await ptero(server, `/files/list?directory=${encodeURIComponent(root)}`);
      const entries = (listing.data || []).map((item) => item.attributes || item).filter((item) => safeName(item.name) && (item.is_file === false || /\.dll$/i.test(item.name))).map((item) => ({ folder: item.name, isDirectory: item.is_file === false }));
      return send(res, 200, { entries });
    }
    if (action === 'manifest') {
      if (!safeName(folder)) return send(res, 400, { error: 'Nome de pasta inválido.' });
      const relative = req.body?.relativePath || '';
      if (typeof relative !== 'string' || relative.length > 1000 || (relative && (relative.split('/').length > 8 || relative.split('/').some((part) => !safeName(part))))) return send(res, 400, { error: 'Subpasta inválida.' });
      const directory = `${root}/${folder}${relative ? `/${relative}` : ''}`;
      const listing = await ptero(server, `/files/list?directory=${encodeURIComponent(directory)}`);
      const children = (listing.data || []).map((item) => item.attributes || item);
      const manifest = children.find((item) => item.is_file !== false && /^manifest(?:\.json)?$/i.test(item.name));
      const base = { server, category, folder, name: folder, version: '' };
      if (!manifest) return send(res, 200, { entry: { ...base, status: 'missing' }, subfolders: children.filter((item) => item.is_file === false && safeName(item.name)).map((item) => item.name) });
      await wait(200);
      const content = await ptero(server, `/files/contents?file=${encodeURIComponent(`${directory}/${manifest.name}`)}`, true);
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed.name !== 'string' || !parsed.name.trim() || parsed.name.length > 255 || typeof parsed.version_number !== 'string' || !parsed.version_number.trim() || parsed.version_number.length > 100) return send(res, 200, { entry: { ...base, status: 'invalid' } });
        return send(res, 200, { entry: { ...base, name: parsed.name.trim(), version: parsed.version_number.trim(), status: 'ok' } });
      } catch { return send(res, 200, { entry: { ...base, status: 'invalid' } }); }
    }
    return send(res, 400, { error: 'Ação inválida.' });
  } catch (error) {
    if (error.status === 429) res.setHeader('Retry-After', String(error.retryAfter || 3));
    return send(res, error.status || 500, { error: error.message || 'Falha ao consultar mods.' });
  }
}
