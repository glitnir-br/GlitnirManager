import { createClient } from '@supabase/supabase-js';

const ROLES = new Set(['adm_principal']);
const MAX_CHARACTER_SIZE = 8 * 1024 * 1024;
const MAX_ACTIVITY_FILES = 90;
const MAX_ACTIVITY_FILE_SIZE = 2 * 1024 * 1024;
const DEFAULT_ROOTS = [
  '/.config/unity3d/IronGate/Valheim/characters',
  '/.config/unity3d/IronGate/Valheim/Characters',
  '/characters',
  '/CharacterFiles',
  '/BepInEx/config/ServerCharacters/characters',
  '/BepInEx/config/ServerCharacters/Characters',
];

function send(res, status, body) { res.status(status).json(body); }
function serverId(server) { return process.env[server === 'server_1' ? 'PTERODACTYL_SERVER_1_ID' : 'PTERODACTYL_SERVER_2_ID']; }
function validServer(server) { return server === 'server_1' || server === 'server_2'; }
function characterRoots() { return [...new Set([...(process.env.PTERODACTYL_CHARACTER_PATHS || '').split(',').map((path) => path.trim()).filter(Boolean), ...DEFAULT_ROOTS])]; }
function safePath(path) { return typeof path === 'string' && path.startsWith('/') && !path.includes('..') && !path.includes('\\'); }

async function ptero(path, options = {}) {
  const base = process.env.PTERODACTYL_URL?.replace(/\/$/, '');
  const key = process.env.PTERODACTYL_API_KEY;
  if (!base || !key) throw new Error('Configuração do Pterodactyl incompleta.');
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } });
  if (!response.ok) {
    const error = new Error(`Pterodactyl respondeu ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  if (options.binary) return response.arrayBuffer();
  if (options.text) return response.text();
  return response.json();
}

async function auth(req) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Configuração do Supabase incompleta.');
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) { const error = new Error('Autenticação necessária.'); error.status = 401; throw error; }
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error: userError } = await admin.auth.getUser(token);
  if (userError || !data.user?.email) { const error = new Error('Sessão inválida.'); error.status = 401; throw error; }
  const { data: profile } = await admin.from('user_profiles').select('role,status').eq('email', data.user.email).maybeSingle();
  if (!profile || !['ativo', 'aprovado'].includes(profile.status) || !ROLES.has(profile.role)) { const error = new Error('Apenas o ADM principal pode inspecionar personagens.'); error.status = 403; throw error; }
}

async function charactersIn(server) {
  const results = [];
  for (const root of characterRoots()) {
    try {
      const listing = await ptero(`/api/client/servers/${serverId(server)}/files/list?directory=${encodeURIComponent(root)}`);
      for (const entry of listing.data || []) {
        const file = entry.attributes || entry;
        if (file.is_file !== false && /\.fch$/i.test(file.name || '')) results.push({ path: `${root}/${file.name}`, name: file.name, size: file.size || 0 });
      }
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }
  return results;
}

async function activityFilesIn(server) {
  const root = '/BepInEx/config/AzuAntiCheat/PlayerActivity';
  const files = [];
  const visit = async (directory) => {
    if (files.length >= MAX_ACTIVITY_FILES) return;
    let listing;
    try { listing = await ptero(`/api/client/servers/${serverId(server)}/files/list?directory=${encodeURIComponent(directory)}`); } catch (error) { if (error.status === 404) return; throw error; }
    const entries = (listing.data || []).map((entry) => entry.attributes || entry).sort((a, b) => String(b.name).localeCompare(String(a.name)));
    for (const entry of entries) {
      if (files.length >= MAX_ACTIVITY_FILES) break;
      const path = `${directory}/${entry.name}`;
      if (entry.is_file === false) await visit(path);
      else if (/\.(?:log|txt|csv|json)$/i.test(entry.name || '') && Number(entry.size || 0) <= MAX_ACTIVITY_FILE_SIZE) files.push({ path, modifiedAt: entry.modified_at || null });
    }
  };
  await visit(root);
  return files;
}

function matchingActivityLines(content, steamid, name) {
  const terms = [String(steamid || ''), String(name || '').trim()].filter(Boolean).map((term) => term.toLowerCase());
  return content.split(/\r?\n/).filter((line) => { const value = line.toLowerCase(); return terms.some((term) => value.includes(term)); }).slice(-80).map(parseActivityLine);
}

function parseActivityLine(line) {
  const [, time = '', type = 'EVENT'] = line.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]/) || [];
  const fields = {};
  for (const match of line.matchAll(/(\w+)=("[^"]*"|[^\s]+)/g)) fields[match[1]] = match[2].replace(/^"|"$/g, '');
  return { line, time, type, fields };
}

async function activityFor(server, steamid, name) {
  const files = await activityFilesIn(server);
  const records = await mapConcurrent(files, 8, async (file) => {
    const content = await ptero(`/api/client/servers/${serverId(server)}/files/contents?file=${encodeURIComponent(file.path)}`, { text: true });
    return matchingActivityLines(content, steamid, name).map((event) => ({ server, path: file.path, modifiedAt: file.modifiedAt, ...event }));
  });
  return records.flat();
}

async function mapConcurrent(values, limit, callback) {
  const result = new Array(values.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) { const index = next; next += 1; result[index] = await callback(values[index]); }
  }));
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  try {
    await auth(req);
    const action = req.body?.action || 'list';
    if (action === 'list') {
      const listings = await Promise.all(['server_1', 'server_2'].map(async (server) => [server, await charactersIn(server)]));
      const grouped = new Map();
      for (const [server, files] of listings) for (const file of files) {
        const item = grouped.get(file.path) || { ...file, servers: [] };
        item.servers.push(server);
        grouped.set(file.path, item);
      }
      return send(res, 200, { characters: [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) });
    }
    if (action === 'activity') {
      const steamid = String(req.body?.steamid || ''); const name = String(req.body?.name || '');
      if (!/^\d{10,25}$/.test(steamid)) return send(res, 400, { error: 'Steam ID inválido.' });
      const activity = (await Promise.all(['server_1', 'server_2'].map((server) => activityFor(server, steamid, name)))).flat().sort((a, b) => `${b.path}/${b.time}`.localeCompare(`${a.path}/${a.time}`)).slice(0, 160);
      const eventCounts = activity.reduce((counts, event) => ({ ...counts, [event.type]: (counts[event.type] || 0) + 1 }), {});
      return send(res, 200, { activity, summary: { total: activity.length, connections: eventCounts.CONNECTED || 0, disconnections: eventCounts.DISCONNECTED || 0, eventCounts } });
    }
    if (action !== 'read' || !validServer(req.body?.server) || !safePath(req.body?.path) || !/\.fch$/i.test(req.body.path)) return send(res, 400, { error: 'Solicitação de personagem inválida.' });
    const payload = await ptero(`/api/client/servers/${serverId(req.body.server)}/files/contents?file=${encodeURIComponent(req.body.path)}`, { binary: true });
    if (!payload.byteLength || payload.byteLength > MAX_CHARACTER_SIZE) return send(res, 413, { error: 'O arquivo de personagem é inválido ou excede 8 MB.' });
    return send(res, 200, { contentBase64: Buffer.from(payload).toString('base64') });
  } catch (error) { return send(res, error.status || 500, { error: error.message || 'Falha ao obter personagens.' }); }
}
