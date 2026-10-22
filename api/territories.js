import { createClient } from '@supabase/supabase-js';

const ROOT = '/BepInEx/config/Marketplace/Configs/Territories/Vip';
const ROLES = new Set(['adm_principal', 'administrador']);
const SERVERS = new Set(['server_1', 'server_2', 'todos']);
const id = (server) => process.env[server === 'server_1' ? 'PTERODACTYL_SERVER_1_ID' : 'PTERODACTYL_SERVER_2_ID'];
const targets = (server) => server === 'todos' ? ['server_1', 'server_2'] : [server];
const send = (res, status, body) => res.status(status).json(body);

async function ptero(path, options = {}) {
  const base = process.env.PTERODACTYL_URL?.replace(/\/$/, ''); const key = process.env.PTERODACTYL_API_KEY;
  if (!base || !key) throw new Error('Configuração do Pterodactyl incompleta.');
  const response = await fetch(`${base}${path}`, { method: options.method || 'GET', body: options.body, headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(options.contentType ? { 'Content-Type': options.contentType } : {}) } });
  if (!response.ok) throw new Error(`Pterodactyl respondeu ${response.status}: ${(await response.text()).slice(0, 250)}`);
  return options.text ? response.text() : (await response.text() || null);
}
async function auth(req) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw Object.assign(new Error('Configuração do Supabase incompleta.'), { status: 500 });
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, ''); if (!token) throw Object.assign(new Error('Autenticação necessária.'), { status: 401 });
  const admin = createClient(url, key, { auth: { persistSession: false } }); const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email) throw Object.assign(new Error('Sessão inválida.'), { status: 401 });
  const { data: profile } = await admin.from('user_profiles').select('role,status').eq('email', data.user.email).maybeSingle();
  if (!profile || !['ativo', 'aprovado'].includes(profile.status)) throw Object.assign(new Error('Usuário sem acesso ativo.'), { status: 403 });
  const { data: permission } = await admin.from('role_permissions').select('allowed').eq('role_key', profile.role).eq('page_key', 'territorios').maybeSingle();
  if (!ROLES.has(profile.role) && !permission?.allowed) throw Object.assign(new Error('Sem permissão para gerenciar territórios.'), { status: 403 });
}
function pathFor(name) {
  const value = String(name || '').trim();
  if (!value || value.length > 80 || /[\\/:*?"<>|\[\]\r\n]/.test(value)) throw Object.assign(new Error('Nome inválido. Não use /, \\, :, *, ?, aspas, colchetes ou quebras de linha.'), { status: 400 });
  return `${ROOT}/${value}.cfg`;
}
async function ensureFolder(server) {
  const listing = JSON.parse(await ptero(`/api/client/servers/${id(server)}/files/list?directory=${encodeURIComponent('/BepInEx/config/Marketplace/Configs/Territories')}`));
  const exists = (listing.data || []).map((entry) => entry.attributes || entry).some((entry) => entry.name === 'Vip' && entry.is_file === false);
  if (!exists) await ptero(`/api/client/servers/${id(server)}/files/create-folder`, { method: 'POST', body: JSON.stringify({ root: '/BepInEx/config/Marketplace/Configs/Territories', name: 'Vip' }), contentType: 'application/json' });
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  try {
    await auth(req); const action = req.body?.action || 'list'; const server = req.body?.server || 'todos';
    if (!SERVERS.has(server)) throw Object.assign(new Error('Servidor inválido.'), { status: 400 });
    if (action === 'list') {
      const inventories = await Promise.all(targets(server).map(async (target) => { try { const result = JSON.parse(await ptero(`/api/client/servers/${id(target)}/files/list?directory=${encodeURIComponent(ROOT)}`)); return { target, files: (result.data || []).map((entry) => entry.attributes || entry).filter((entry) => entry.is_file !== false && entry.name.endsWith('.cfg')).map((entry) => ({ name: entry.name })) }; } catch { return { target, files: [] }; } }));
      const territories = new Map(); for (const inventory of inventories) for (const file of inventory.files) { const item = territories.get(file.name) || { file: file.name, servers: [] }; item.servers.push(inventory.target); territories.set(file.name, item); }
      return send(res, 200, { territories: [...territories.values()].sort((a, b) => a.file.localeCompare(b.file, 'pt-BR')) });
    }
    const name = String(req.body?.name || '').trim(); const file = pathFor(name);
    if (action === 'read') { if (server === 'todos') throw Object.assign(new Error('Selecione um servidor para editar.'), { status: 400 }); return send(res, 200, { content: await ptero(`/api/client/servers/${id(server)}/files/contents?file=${encodeURIComponent(file)}`, { text: true }) }); }
    if (action === 'save') { const content = String(req.body?.content || ''); if (!content.startsWith(`[${name}`) || content.length > 20_000) throw Object.assign(new Error('Configuração do território inválida.'), { status: 400 }); await Promise.all(targets(server).map(async (target) => { await ensureFolder(target); await ptero(`/api/client/servers/${id(target)}/files/write?file=${encodeURIComponent(file)}`, { method: 'POST', body: content, contentType: 'text/plain', text: true }); })); return send(res, 200, { success: true }); }
    if (action === 'delete') { await Promise.all(targets(server).map((target) => ptero(`/api/client/servers/${id(target)}/files/delete`, { method: 'POST', body: JSON.stringify({ root: ROOT, files: [`${name}.cfg`] }), contentType: 'application/json' }))); return send(res, 200, { success: true }); }
    throw Object.assign(new Error('Ação inválida.'), { status: 400 });
  } catch (error) { return send(res, error.status || 500, { error: error.message || 'Falha ao gerenciar territórios.' }); }
}
