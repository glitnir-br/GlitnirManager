import { createClient } from '@supabase/supabase-js';

const WHITELIST_PATH = '/.config/unity3d/IronGate/Valheim/permittedlist.txt';
const CHARACTERS_PATH = '/.config/unity3d/IronGate/Valheim/characters_local';
const GUILDS_PATH = '/.config/unity3d/IronGate/Valheim/Guilds';
const ALLOWED_ROLES = new Set(['adm_principal', 'administrador']);

function send(res, status, body) {
  res.status(status).json(body);
}

function parseWhitelist(content) {
  const entries = new Map();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const id = line.match(/\d{15,20}/)?.[0];
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

function parseGuildMembers(guildFiles) {
  const bySteamId = new Map();
  const conflicts = [];
  const unmatchedFiles = [];

  for (const { name, content } of guildFiles) {
    const guildName = name.replace(/\.ya?ml$/i, '');
    const lines = content.split(/\r?\n/);
    let insideMembers = false;
    let membersFound = 0;

    for (const line of lines) {
      if (/^members\s*:/i.test(line)) {
        insideMembers = true;
        continue;
      }
      if (insideMembers && /^\S/.test(line) && !/^\s*-/.test(line)) break;
      if (!insideMembers) continue;

      // O YamlDotNet pode salvar PlayerReference como escalar
      // (`player: Steam_123:Nome`) ou como objeto (`player:` + `id:`).
      const referenceValue = line.match(/^\s*(?:-\s*)?(?:player|id)\s*:\s*["']?(.+?)["']?\s*$/i)?.[1];
      const steamid = referenceValue?.match(/\d{15,20}/)?.[0];
      if (!steamid) continue;
      membersFound += 1;

      if (bySteamId.has(steamid) && bySteamId.get(steamid) !== guildName) {
        conflicts.push({ steamid, guilds: [bySteamId.get(steamid), guildName] });
        continue;
      }
      bySteamId.set(steamid, guildName);
    }

    if (membersFound === 0) unmatchedFiles.push(name);
  }

  return { bySteamId, conflicts, unmatchedFiles };
}

async function pterodactylRequest(path, responseType = 'json', options = {}) {
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

    const requestedSteamId = String(req.body?.steamid || '').trim().replace(/^Steam_/i, '');
    const requestedObservation = String(req.body?.observacao || '').trim();
    if (requestedSteamId && !/^\d{17}$/.test(requestedSteamId)) return send(res, 400, { error: 'Steam ID inválido.' });
    const encodedWhitelist = encodeURIComponent(WHITELIST_PATH);
    const encodedCharacters = encodeURIComponent(CHARACTERS_PATH);
    const encodedGuilds = encodeURIComponent(GUILDS_PATH);
    const [whitelistContent, characterListing, guildListing] = await Promise.all([
      pterodactylRequest(`/api/client/servers/${serverId}/files/contents?file=${encodedWhitelist}`, 'text'),
      pterodactylRequest(`/api/client/servers/${serverId}/files/list?directory=${encodedCharacters}`),
      pterodactylRequest(`/api/client/servers/${serverId}/files/list?directory=${encodedGuilds}`),
    ]);

    let whitelist = parseWhitelist(whitelistContent);
    let addedToPterodactyl = false;
    if (requestedSteamId && !whitelist.some((entry) => entry.steamid === requestedSteamId)) {
      const separator = whitelistContent && !whitelistContent.endsWith('\n') ? '\n' : '';
      await pterodactylRequest(`/api/client/servers/${serverId}/files/write?file=${encodedWhitelist}`, 'text', {
        method: 'POST', body: `${whitelistContent}${separator}${requestedSteamId}\n`, contentType: 'text/plain',
      });
      whitelist = [...whitelist, { steamid: requestedSteamId, label: null }];
      addedToPterodactyl = true;
    }
    const parsedCharacters = parseCharacterFiles(characterListing?.data || []);
    const guildFileNames = (guildListing?.data || [])
      .map((file) => file?.attributes || file)
      .filter((file) => file?.is_file !== false && /\.ya?ml$/i.test(file?.name || ''))
      .map((file) => file.name);
    const guildFiles = await Promise.all(guildFileNames.map(async (name) => ({
      name,
      content: await pterodactylRequest(
        `/api/client/servers/${serverId}/files/contents?file=${encodeURIComponent(`${GUILDS_PATH}/${name}`)}`,
        'text',
      ),
    })));
    const parsedGuilds = parseGuildMembers(guildFiles);
    const syncedAt = new Date().toISOString();

    const { data: existingPlayers, error: listError } = await admin
      .from('players')
      .select('id,steamid,nick,status')
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
        guilda: parsedGuilds.bySteamId.get(entry.steamid) || '',
      };
      const matches = playersBySteamId.get(entry.steamid) || [];
      const importedName = '';

      if (matches.length) {
        for (const player of matches) {
          const status = personagens.length === 0
            ? 'inativo'
            : (player.status === 'inativo' ? 'ativo' : player.status);
          const playerChanges = {
            ...changes,
            status,
            ...(player.nick === entry.steamid ? { nick: importedName } : {}),
          };
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
          status: personagens.length ? 'ativo' : 'inativo',
          duplicado: false,
        });
        if (error) throw error;
        created += 1;
      }
    }

    if (requestedSteamId && requestedObservation) {
      const { error } = await admin.from('players').update({ observacao: requestedObservation }).eq('server', server).eq('steamid', requestedSteamId);
      if (error) throw error;
    }

    if (requestedSteamId) await admin.from('security_logs').insert({ action: 'pterodactyl_whitelist_add', user_email: authData.user.email, performed_by: authData.user.email, details: `Steam ID ${requestedSteamId} ${addedToPterodactyl ? 'adicionado à' : 'já presente na'} whitelist do ${server}.`, timestamp: new Date().toISOString() });
    return send(res, 200, {
      server,
      whitelist: whitelist.length,
      created,
      updated,
      withoutCharacter,
      guildFiles: guildFiles.length,
      guildAssignments: parsedGuilds.bySteamId.size,
      guildConflicts: parsedGuilds.conflicts,
      unmatchedGuildFiles: parsedGuilds.unmatchedFiles,
      unmatchedCharacterFiles: parsedCharacters.ignored.slice(0, 20),
      syncedAt,
      addedToPterodactyl,
    });
  } catch (error) {
    console.error('Falha ao sincronizar whitelist:', error);
    return send(res, 500, { error: error.message || 'Falha ao sincronizar whitelist.' });
  }
}
