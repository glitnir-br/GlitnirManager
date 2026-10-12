import { createClient } from '@supabase/supabase-js';

const WHITELIST_PATH = '/.config/unity3d/IronGate/Valheim/permittedlist.txt';
const CHARACTERS_PATH = '/.config/unity3d/IronGate/Valheim/characters_local';
const ALLOWED_ROLES = new Set(['adm_principal', 'administrador']);

function send(res, status, body) {
  res.status(status).json(body);
}

function parseWhitelist(content) {
  const entries = new Map();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const id = line.match(/\b\d{15,20}\b/)?.[0];
    if (!id) continue;
    const label = line
      .replace(id, '')
      .replace(/^\s*(?:#|\/\/|[-:;])\s*/, '')
      .replace(/\s*(?:#|\/\/).*$/, '')
      .trim();
    entries.set(id, { steamid: id, label: label || null });
  }
  return [...entries.values()];
}

function parseCharacterFiles(files) {
  const characters = new Map();
  const ignored = [];

  for (const file of files) {
    const attributes = file?.attributes || file;
    const name = attributes?.name || '';
    if (!name || attributes?.is_file === false) continue;
    if (/backup|\.old$|\.bak$/i.test(name)) continue;

    const match = name.match(/^Steam_(\d{15,20})_(.+?)\.(?:fch|sss)$/i)
      || name.match(/^(\d{15,20})[_-](.+?)\.(?:fch|sss)$/i);

    if (!match) {
      if (/\.(?:fch|sss)$/i.test(name)) ignored.push(name);
      continue;
    }

    const [, steamid, rawCharacterName] = match;
    const characterName = rawCharacterName.trim();
    if (!characters.has(steamid)) characters.set(steamid, new Set());
    characters.get(steamid).add(characterName);
  }

  return {
    bySteamId: new Map([...characters].map(([id, names]) => [id, [...names].sort()])),
    ignored,
  };
}

async function pterodactylRequest(path, responseType = 'json') {
  const baseUrl = process.env.PTERODACTYL_URL?.replace(/\/$/, '');
  const apiKey = process.env.PTERODACTYL_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('Configuração do Pterodactyl incompleta.');

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
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

    const { data: profile } = await admin
      .from('user_profiles')
      .select('role,status')
      .eq('email', authData.user.email)
      .maybeSingle();
    if (!profile || !['ativo', 'aprovado'].includes(profile.status) || !ALLOWED_ROLES.has(profile.role)) {
      return send(res, 403, { error: 'Somente administradores podem sincronizar a whitelist.' });
    }

    const server = req.body?.server;
    if (!['server_1', 'server_2'].includes(server)) return send(res, 400, { error: 'Servidor inválido.' });
    const serverId = process.env[server === 'server_1' ? 'PTERODACTYL_SERVER_1_ID' : 'PTERODACTYL_SERVER_2_ID'];
    if (!serverId) return send(res, 500, { error: `ID do ${server} não configurado.` });

    const encodedWhitelist = encodeURIComponent(WHITELIST_PATH);
    const encodedCharacters = encodeURIComponent(CHARACTERS_PATH);
    const [whitelistContent, characterListing] = await Promise.all([
      pterodactylRequest(`/api/client/servers/${serverId}/files/contents?file=${encodedWhitelist}`, 'text'),
      pterodactylRequest(`/api/client/servers/${serverId}/files/list?directory=${encodedCharacters}`),
    ]);

    const whitelist = parseWhitelist(whitelistContent);
    const parsedCharacters = parseCharacterFiles(characterListing?.data || []);
    const syncedAt = new Date().toISOString();

    const { data: existingPlayers, error: listError } = await admin
      .from('players')
      .select('id,steamid,nick')
      .eq('server', server);
    if (listError) throw listError;

    const playersBySteamId = new Map();
    for (const player of existingPlayers || []) {
      if (!playersBySteamId.has(player.steamid)) playersBySteamId.set(player.steamid, []);
      playersBySteamId.get(player.steamid).push(player);
    }

    const { error: resetError } = await admin
      .from('players')
      .update({ na_whitelist: false, whitelist_sincronizada: true, whitelist_synced_at: syncedAt })
      .eq('server', server);
    if (resetError) throw resetError;

    let created = 0;
    let updated = 0;
    let withoutCharacter = 0;

    for (const entry of whitelist) {
      const personagens = parsedCharacters.bySteamId.get(entry.steamid) || [];
      if (personagens.length === 0) withoutCharacter += 1;
      const changes = {
        na_whitelist: true,
        whitelist_sincronizada: true,
        whitelist_synced_at: syncedAt,
        personagens,
      };
      const matches = playersBySteamId.get(entry.steamid) || [];
      const importedName = entry.label || personagens[0] || '';

      if (matches.length) {
        for (const player of matches) {
          const playerChanges = player.nick === entry.steamid
            ? { ...changes, nick: importedName }
            : changes;
          const { error } = await admin.from('players').update(playerChanges).eq('id', player.id);
          if (error) throw error;
          updated += 1;
        }
      } else {
        const { error } = await admin.from('players').insert({
          ...changes,
          server,
          steamid: entry.steamid,
          nick: importedName,
          status: 'ativo',
          duplicado: false,
        });
        if (error) throw error;
        created += 1;
      }
    }

    return send(res, 200, {
      server,
      whitelist: whitelist.length,
      created,
      updated,
      withoutCharacter,
      unmatchedCharacterFiles: parsedCharacters.ignored.slice(0, 20),
      syncedAt,
    });
  } catch (error) {
    console.error('Falha ao sincronizar whitelist:', error);
    return send(res, 500, { error: error.message || 'Falha ao sincronizar whitelist.' });
  }
}
