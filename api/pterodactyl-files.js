import { createClient } from '@supabase/supabase-js';

const ALLOWED_ROLES = new Set(['adm_principal', 'administrador']);
const TEXT_EXTENSIONS = new Set(['txt', 'json', 'yml', 'yaml', 'cfg', 'conf', 'ini', 'log', 'md', 'xml', 'csv', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'sh', 'properties']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
const MAX_PREVIEW_SIZE = 3 * 1024 * 1024;

function send(res, status, body) { res.status(status).json(body); }
function serverId(server) { return process.env[server === 'server_1' ? 'PTERODACTYL_SERVER_1_ID' : 'PTERODACTYL_SERVER_2_ID']; }
function extension(name) { return name.split('.').pop()?.toLowerCase() || ''; }
function isSafePath(path) { return typeof path === 'string' && path.startsWith('/') && !path.split('/').includes('..'); }
function imageContentType(name) { return { jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' }[extension(name)] || `image/${extension(name)}`; }

async function pterodactylRequest(path, responseType = 'json') {
  const baseUrl = process.env.PTERODACTYL_URL?.replace(/\/$/, '');
  const apiKey = process.env.PTERODACTYL_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('Configuração do Pterodactyl incompleta.');
  const response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Pterodactyl respondeu ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return responseType === 'buffer' ? response.arrayBuffer() : response.json();
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
  if (!profile || !['ativo', 'aprovado'].includes(profile.status) || !ALLOWED_ROLES.has(profile.role)) { const roleError = new Error('Somente administradores podem acessar os arquivos do servidor.'); roleError.status = 403; throw roleError; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'Método não permitido.' }); }
  try {
    await authenticate(req);
    const server = req.body?.server;
    if (!['server_1', 'server_2'].includes(server)) return send(res, 400, { error: 'Servidor inválido.' });
    const id = serverId(server);
    if (!id) throw new Error(`ID do ${server} não configurado.`);
    const action = req.body?.action || 'list';
    const path = String(req.body?.path || '/');
    if (!isSafePath(path)) return send(res, 400, { error: 'Caminho inválido.' });
    if (action === 'list') {
      const listing = await pterodactylRequest(`/api/client/servers/${id}/files/list?directory=${encodeURIComponent(path)}`);
      const files = (listing.data || []).map((entry) => entry.attributes || entry).map((file) => ({
        name: file.name,
        isDirectory: file.is_file === false,
        size: file.size || 0,
        modifiedAt: file.modified_at || null,
      })).sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name, 'pt-BR'));
      return send(res, 200, { path, files });
    }
    if (action === 'read') {
      if (path === '/' || !path.includes('.')) return send(res, 400, { error: 'Selecione um arquivo para visualizar.' });
      const fileExtension = extension(path);
      if (!TEXT_EXTENSIONS.has(fileExtension) && !IMAGE_EXTENSIONS.has(fileExtension)) return send(res, 400, { error: 'Este tipo de arquivo não possui prévia.' });
      const content = Buffer.from(await pterodactylRequest(`/api/client/servers/${id}/files/contents?file=${encodeURIComponent(path)}`, 'buffer'));
      if (content.length > MAX_PREVIEW_SIZE) return send(res, 413, { error: 'O arquivo é grande demais para pré-visualização (limite de 3 MB).' });
      res.setHeader('Content-Type', IMAGE_EXTENSIONS.has(fileExtension) ? imageContentType(path) : 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'private, max-age=60');
      return res.status(200).send(content);
    }
    return send(res, 400, { error: 'Ação inválida.' });
  } catch (error) {
    console.error('Falha ao acessar arquivos do Pterodactyl:', error);
    return send(res, error.status || 500, { error: error.message || 'Falha ao acessar arquivos do servidor.' });
  }
}
