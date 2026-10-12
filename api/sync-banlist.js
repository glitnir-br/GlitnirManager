import { createClient } from '@supabase/supabase-js';

const BANLIST_PATH = '/.config/unity3d/IronGate/Valheim/bannedlist.txt';
const CHARACTERS_PATH = '/.config/unity3d/IronGate/Valheim/characters_local';
const ALLOWED_ROLES = new Set(['adm_principal', 'administrador']);

function send(res, status, body) {
  res.status(status).json(body);
}

function parseIds(content) {
  return [...new Set(content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'))
    .map((line) => line.match(/\d{15,20}/)?.[0])
    .filter(Boolean))];
}

function parseCharacterFiles(files) {
  const characters = new Map();
  for (const file of files) {
    const attributes = file?.attributes || file;
    const name = attributes?.name || '';
    if (!name || attributes?.is_file === false || /backup|\.old$|\.bak$/i.test(name)) continue;
    const match = name.match(/^Steam_(\d{15,20})_(.+?)\.(?:fch|sss)$/i)
      || name.match(/^(\d{15,20})[_-](.+?)\.(?:fch|sss)$/i);
    if (!match) continue;
    const [, steamid, rawName] = match;
    if (!characters.has(steamid)) characters.set(steamid, new Set());
    characters.get(steamid).add(rawName.trim());
  }
  return new Map([...characters].map(([id, names]) => [id, [...names].filter(Boolean).sort()]));
}

async function pterodactylRequest(path, responseType = 'json', options = {}) {
  const baseUrl = process.env.PTERODACTYL_URL?.replace(/\/$/, '');
  const apiKey = process.env.PTERODACTYL_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('Configuração do Pterodactyl incompleta.');
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET', body: options.body,
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', ...(options.contentType ? { 'Content-Type': options.contentType } : {}) },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Pterodactyl respondeu ${response.status}: ${detail.slice(0, 300)}`);
  }
  return responseType === 'text' ? response.text() : response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Método não permitido.' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!supabaseUrl || !serviceKey) return send(res, 500, { error: 'Configuração do Supabase incompleta.' });
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return send(res, 401, { error: 'Autenticação necessária.' });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user?.email) return send(res, 401, { error: 'Sessão inválida.' });
    const { data: profile } = await admin.from('user_profiles').select('role,status').eq('email', authData.user.email).maybeSingle();
    if (!profile || !['ativo', 'aprovado'].includes(profile.status) || !ALLOWED_ROLES.has(profile.role)) {
      return send(res, 403, { error: 'Somente administradores podem sincronizar a lista de banidos.' });
    }

    const server = req.body?.server;
    if (!['server_1', 'server_2'].includes(server)) return send(res, 400, { error: 'Servidor inválido.' });
    const serverId = process.env[server === 'server_1' ? 'PTERODACTYL_SERVER_1_ID' : 'PTERODACTYL_SERVER_2_ID'];
    if (!serverId) return send(res, 500, { error: `ID do ${server} não configurado.` });

    const requestedSteamId = String(req.body?.steamid || '').trim().replace(/^Steam_/i, '');
    const requestedObservation = String(req.body?.observacao || '').trim();
    if (requestedSteamId && !/^\d{17}$/.test(requestedSteamId)) return send(res, 400, { error: 'Steam ID inválido.' });
    const [banlistContent, characterListing] = await Promise.all([
      pterodactylRequest(`/api/client/servers/${serverId}/files/contents?file=${encodeURIComponent(BANLIST_PATH)}`, 'text'),
      pterodactylRequest(`/api/client/servers/${serverId}/files/list?directory=${encodeURIComponent(CHARACTERS_PATH)}`),
    ]);
    const steamids = parseIds(banlistContent);
    let addedToPterodactyl = false;
    if (requestedSteamId && !steamids.includes(requestedSteamId)) {
      const separator = banlistContent && !banlistContent.endsWith('\n') ? '\n' : '';
      await pterodactylRequest(`/api/client/servers/${serverId}/files/write?file=${encodeURIComponent(BANLIST_PATH)}`, 'text', {
        method: 'POST', body: `${banlistContent}${separator}${requestedSteamId}\n`, contentType: 'text/plain',
      });
      steamids.push(requestedSteamId);
      addedToPterodactyl = true;
    }
    const characters = parseCharacterFiles(characterListing?.data || []);
    const syncedAt = new Date().toISOString();

    const { data: existing, error: listError } = await admin.from('banidos').select('id,steamid').eq('server', server);
    if (listError) throw listError;
    const bySteamId = new Map();
    for (const item of existing || []) {
      if (!bySteamId.has(item.steamid)) bySteamId.set(item.steamid, []);
      bySteamId.get(item.steamid).push(item);
    }

    const { error: resetError } = await admin.from('banidos')
      .update({ na_banlist: false, banlist_sincronizada: true, banlist_synced_at: syncedAt })
      .eq('server', server);
    if (resetError) throw resetError;

    let created = 0;
    let updated = 0;
    let withoutCharacter = 0;
    for (const steamid of steamids) {
      const personagens = characters.get(steamid) || [];
      if (!personagens.length) withoutCharacter += 1;
      const changes = { personagens, na_banlist: true, banlist_sincronizada: true, banlist_synced_at: syncedAt };
      const matches = bySteamId.get(steamid) || [];
      if (matches.length) {
        const { error } = await admin.from('banidos').update(changes).in('id', matches.map((item) => item.id));
        if (error) throw error;
        updated += matches.length;
      } else {
        const { error } = await admin.from('banidos').insert({
          ...changes, server, steamid, nick: '', motivo: 'OUTRO', observacao: 'Importado do bannedlist.txt',
        });
        if (error) throw error;
        created += 1;
      }
    }

    if (steamids.length > 0) {
      const { error: playerStatusError } = await admin
        .from('players')
        .update({ status: 'banido' })
        .eq('server', server)
        .in('steamid', steamids);
      if (playerStatusError) throw playerStatusError;
    }

    if (requestedSteamId && requestedObservation) {
      const { error } = await admin.from('banidos').update({ observacao: requestedObservation }).eq('server', server).eq('steamid', requestedSteamId);
      if (error) throw error;
    }

    if (requestedSteamId) await admin.from('security_logs').insert({ action: 'pterodactyl_banlist_add', user_email: authData.user.email, performed_by: authData.user.email, details: `Steam ID ${requestedSteamId} ${addedToPterodactyl ? 'adicionado à' : 'já presente na'} banlist do ${server}.`, timestamp: new Date().toISOString() });
    return send(res, 200, { server, banned: steamids.length, created, updated, withoutCharacter, syncedAt, addedToPterodactyl });
  } catch (error) {
    console.error('Falha ao sincronizar lista de banidos:', error);
    return send(res, 500, { error: error.message || 'Falha ao sincronizar lista de banidos.' });
  }
}
