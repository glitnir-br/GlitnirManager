import { createClient } from '@supabase/supabase-js';
import { executeRcon } from './rcon.js';

const SERVERS = ['server_1', 'server_2'];
const DEFAULT_DASHBOARD_ROLES = new Set(['adm_principal', 'administrador', 'financeiro', 'visitante']);

function send(res, status, body) { res.status(status).json(body); }

async function authenticate(req) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw Object.assign(new Error('Configuração do Supabase incompleta.'), { status: 500 });
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Autenticação necessária.'), { status: 401 });
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email) throw Object.assign(new Error('Sessão inválida.'), { status: 401 });
  const { data: profile } = await admin.from('user_profiles').select('role,status').eq('email', data.user.email).maybeSingle();
  if (!profile || !['ativo', 'aprovado'].includes(profile.status)) throw Object.assign(new Error('Usuário sem acesso ativo.'), { status: 403 });
  const { data: permissions, error: permissionError } = await admin.from('role_permissions').select('page_key,allowed').eq('role_key', profile.role);
  if (permissionError) throw permissionError;
  const allowed = profile.role === 'adm_principal' || (permissions?.length
    ? permissions.some((item) => item.page_key === 'dashboard' && item.allowed)
    : DEFAULT_DASHBOARD_ROLES.has(profile.role));
  if (!allowed) throw Object.assign(new Error('Seu cargo não possui permissão para visualizar o Dashboard.'), { status: 403 });
  return data.user.email;
}

function parsePlayers(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)\s+Steam ID:\s*(\d{10,25})(.*)$/i);
      if (!match) return null;
      const platform = match[3].match(/Platform name:\s*(.+?)\s*$/i)?.[1]?.trim() || '';
      return { name: match[1].trim(), steamid: match[2], platform };
    })
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método não permitido.' });
  try {
    const actor = await authenticate(req);
    const settled = await Promise.allSettled(SERVERS.map(async (server) => {
      const output = await executeRcon(server, 'players');
      return { server, players: parsePlayers(output) };
    }));
    const servers = Object.fromEntries(settled.map((result, index) => {
      const server = SERVERS[index];
      return result.status === 'fulfilled'
        ? [server, { players: result.value.players, error: null }]
        : [server, { players: [], error: result.reason?.message || 'Falha ao consultar jogadores.' }];
    }));
    console.info('RCON online players', { actor, at: new Date().toISOString() });
    return send(res, 200, { servers, updatedAt: new Date().toISOString() });
  } catch (error) {
    return send(res, error.status || 500, { error: error.message || 'Falha ao consultar jogadores online.' });
  }
}
