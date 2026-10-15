import { createClient } from '@supabase/supabase-js';

const CONFIG_ROOT = '/BepInEx/config';
const SERVERS = ['server_1', 'server_2'];
const ADMIN_ROLES = new Set(['adm_principal', 'administrador']);

const send = (res, status, body) => res.status(status).json(body);
const serverId = (server) => process.env[server === 'server_1' ? 'PTERODACTYL_SERVER_1_ID' : 'PTERODACTYL_SERVER_2_ID'];
const targets = (server) => server === 'todos' ? SERVERS : [server];

async function ptero(path, options = {}) {
  const baseUrl = process.env.PTERODACTYL_URL?.replace(/\/$/, '');
  const apiKey = process.env.PTERODACTYL_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('Configuração do Pterodactyl incompleta.');
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    body: options.body,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(options.contentType ? { 'Content-Type': options.contentType } : {}),
    },
  });
  if (!response.ok) throw new Error(`Pterodactyl respondeu ${response.status}: ${(await response.text()).slice(0, 250)}`);
  const content = await response.text();
  return content ? JSON.parse(content) : null;
}

async function authenticate(req) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!url || !key || !token) {
    const error = new Error('Autenticação necessária.');
    error.status = 401;
    throw error;
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email) {
    const authError = new Error('Sessão inválida.');
    authError.status = 401;
    throw authError;
  }
  const { data: profile } = await admin.from('user_profiles').select('role,status').eq('email', data.user.email).maybeSingle();
  if (!profile || !['ativo', 'aprovado'].includes(profile.status)) {
    const accessError = new Error('Acesso não autorizado.');
    accessError.status = 403;
    throw accessError;
  }
  return profile;
}

async function statusFor(server) {
  const [listingResult, resourcesResult] = await Promise.allSettled([
    ptero(`/api/client/servers/${serverId(server)}/files/list?directory=${encodeURIComponent(CONFIG_ROOT)}`),
    ptero(`/api/client/servers/${serverId(server)}/resources`),
  ]);
  const listing = listingResult.status === 'fulfilled' ? listingResult.value : null;
  const resources = resourcesResult.status === 'fulfilled' ? resourcesResult.value : null;
  const entry = (listing?.data || []).map((item) => item.attributes || item).find((item) => item.name === 'maintenance');
  return {
    server,
    enabled: listing ? Boolean(entry && entry.is_file !== false) : null,
    powerState: resources?.attributes?.current_state || 'unavailable',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  try {
    const profile = await authenticate(req);
    const action = req.body?.action || 'status';
    if (action === 'status') return send(res, 200, { servers: await Promise.all(SERVERS.map(statusFor)) });

    if (action !== 'set') return send(res, 400, { error: 'Ação inválida.' });
    if (!ADMIN_ROLES.has(profile.role)) return send(res, 403, { error: 'Somente administradores podem alterar a manutenção.' });
    const server = req.body?.server;
    const enabled = req.body?.enabled;
    if (!['server_1', 'server_2', 'todos'].includes(server) || typeof enabled !== 'boolean') return send(res, 400, { error: 'Dados de manutenção inválidos.' });

    await Promise.all(targets(server).map(async (target) => {
      const current = await statusFor(target);
      if (current.powerState !== 'running') throw new Error(`${target === 'server_1' ? 'Server 1' : 'Server 2'} precisa estar ligado para alterar a manutenção.`);
      if (enabled && !current.enabled) {
        await ptero(`/api/client/servers/${serverId(target)}/files/write?file=${encodeURIComponent(`${CONFIG_ROOT}/maintenance`)}`, { method: 'POST', body: '', contentType: 'text/plain' });
      }
      if (!enabled && current.enabled) {
        await ptero(`/api/client/servers/${serverId(target)}/files/delete`, { method: 'POST', body: JSON.stringify({ root: CONFIG_ROOT, files: ['maintenance'] }), contentType: 'application/json' });
      }
    }));

    return send(res, 200, { servers: await Promise.all(SERVERS.map(statusFor)) });
  } catch (error) {
    return send(res, error.status || 500, { error: error.message || 'Falha ao alterar a manutenção.' });
  }
}
