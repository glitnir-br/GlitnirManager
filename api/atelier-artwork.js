import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };

const ARTWORK_PATH = '/BepInEx/config/GlitnirGuildAtelier/Artwork';
const ALLOWED_ROLES = new Set(['adm_principal', 'administrador']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
const MAX_FILE_SIZE = 8 * 1024 * 1024;

function send(res, status, body) { res.status(status).json(body); }
function serverId(server) { return process.env[server === 'server_1' ? 'PTERODACTYL_SERVER_1_ID' : 'PTERODACTYL_SERVER_2_ID']; }
function targets(server) { return server === 'todos' ? ['server_1', 'server_2'] : [server]; }
function isImageName(name) { return IMAGE_EXTENSIONS.has(name.split('.').pop()?.toLowerCase()); }

async function pterodactylRequest(path, responseType = 'json', options = {}) {
  const baseUrl = process.env.PTERODACTYL_URL?.replace(/\/$/, '');
  const apiKey = process.env.PTERODACTYL_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('Configuração do Pterodactyl incompleta.');
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET', body: options.body,
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', ...(options.contentType ? { 'Content-Type': options.contentType } : {}) },
  });
  if (!response.ok) throw new Error(`Pterodactyl respondeu ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return responseType === 'text' ? response.text() : response.json();
}

async function listServer(server) {
  const id = serverId(server);
  if (!id) throw new Error(`ID do ${server} não configurado.`);
  const listing = await pterodactylRequest(`/api/client/servers/${id}/files/list?directory=${encodeURIComponent(ARTWORK_PATH)}`);
  return (listing.data || []).map((entry) => entry.attributes || entry)
    .filter((file) => file.is_file !== false && isImageName(file.name || ''))
    .map((file) => ({ name: file.name, size: file.size || 0, modifiedAt: file.modified_at || null }));
}

async function authenticate(req) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Configuração do Supabase incompleta.');
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) { const error = new Error('Autenticação necessária.'); error.status = 401; throw error; }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email) { const authError = new Error('Sessão inválida.'); authError.status = 401; throw authError; }
  const { data: profile } = await admin.from('user_profiles').select('role,status').eq('email', data.user.email).maybeSingle();
  if (!profile || !['ativo', 'aprovado'].includes(profile.status) || !ALLOWED_ROLES.has(profile.role)) { const roleError = new Error('Somente administradores podem gerenciar o Atelier.'); roleError.status = 403; throw roleError; }
  return data.user.email;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'Método não permitido.' }); }
  try {
    const userEmail = await authenticate(req);
    const action = req.body?.action || 'list';
    if (action === 'list') {
      const [server1, server2] = await Promise.all([listServer('server_1'), listServer('server_2')]);
      const merged = new Map();
      for (const [server, files] of [['server_1', server1], ['server_2', server2]]) for (const file of files) {
        const item = merged.get(file.name) || { name: file.name, servers: [], size: file.size, modifiedAt: file.modifiedAt };
        item.servers.push(server); item.size = Math.max(item.size || 0, file.size || 0); item.modifiedAt = item.modifiedAt || file.modifiedAt; merged.set(file.name, item);
      }
      return send(res, 200, { files: [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) });
    }

    const server = req.body?.server;
    if (!['server_1', 'server_2', 'todos'].includes(server)) return send(res, 400, { error: 'Servidor inválido.' });
    const name = String(req.body?.name || '').trim();
    if (!name || name !== name.split(/[\\/]/).pop() || !isImageName(name)) return send(res, 400, { error: 'Informe um arquivo de imagem válido.' });
    const selectedServers = targets(server);
    if (action === 'delete') {
      await Promise.all(selectedServers.map(async (target) => {
        const id = serverId(target); if (!id) throw new Error(`ID do ${target} não configurado.`);
        await pterodactylRequest(`/api/client/servers/${id}/files/delete`, 'json', { method: 'POST', body: JSON.stringify({ root: ARTWORK_PATH, files: [name] }), contentType: 'application/json' });
      }));
    } else if (action === 'upload') {
      const content = String(req.body?.contentBase64 || '');
      const mime = String(req.body?.mime || '');
      if (!mime.startsWith('image/') || !content) return send(res, 400, { error: 'Envie apenas arquivos de imagem.' });
      const buffer = Buffer.from(content, 'base64');
      if (!buffer.length || buffer.length > MAX_FILE_SIZE) return send(res, 400, { error: 'A imagem deve ter no máximo 8 MB.' });
      await Promise.all(selectedServers.map(async (target) => {
        const id = serverId(target); if (!id) throw new Error(`ID do ${target} não configurado.`);
        await pterodactylRequest(`/api/client/servers/${id}/files/write?file=${encodeURIComponent(`${ARTWORK_PATH}/${name}`)}`, 'text', { method: 'POST', body: buffer, contentType: mime });
      }));
    } else return send(res, 400, { error: 'Ação inválida.' });
    return send(res, 200, { success: true, server, name, userEmail });
  } catch (error) {
    console.error('Falha ao gerenciar imagens do Atelier:', error);
    return send(res, error.status || 500, { error: error.message || 'Falha ao gerenciar imagens do Atelier.' });
  }
}
