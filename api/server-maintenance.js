import { createClient } from '@supabase/supabase-js';
import dgram from 'node:dgram';

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
  return { admin, profile, email: data.user.email };
}

const readCString = (buffer, offset) => {
  const end = buffer.indexOf(0, offset);
  return end < 0 ? null : { value: buffer.toString('utf8', offset, end), next: end + 1 };
};

function readPlayerCount(packet) {
  // Resposta A2S_INFO: cabeçalho, tipo, protocolo, quatro strings e app id.
  if (packet.length < 6 || packet[4] !== 0x49) return null;
  let offset = 6;
  for (let index = 0; index < 4; index += 1) {
    const field = readCString(packet, offset);
    if (!field) return null;
    offset = field.next;
  }
  if (offset + 4 > packet.length) return null;
  offset += 2; // app id
  return { onlinePlayers: packet[offset], maxPlayers: packet[offset + 1] };
}

function queryValheim(ip, port) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const request = Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]), Buffer.from('Source Engine Query\0')]);
    let retryWithChallenge = false;
    let completed = false;
    const finish = (value = null) => {
      if (completed) return;
      completed = true;
      socket.close();
      resolve(value);
    };
    const timeout = setTimeout(finish, 2500);

    socket.once('error', () => { clearTimeout(timeout); finish(); });
    socket.on('message', (packet) => {
      const count = readPlayerCount(packet);
      if (count) { clearTimeout(timeout); finish(count); return; }
      // Alguns servidores exigem o desafio A2S antes de devolver as informações.
      if (!retryWithChallenge && packet.length >= 9 && packet[4] === 0x41) {
        retryWithChallenge = true;
        socket.send(Buffer.concat([request, packet.subarray(5, 9)]), port, ip);
      }
    });
    socket.send(request, port, ip);
  });
}

async function statusFor(server, schedule = null) {
  const [listingResult, resourcesResult, allocationsResult] = await Promise.allSettled([
    ptero(`/api/client/servers/${serverId(server)}/files/list?directory=${encodeURIComponent(CONFIG_ROOT)}`),
    ptero(`/api/client/servers/${serverId(server)}/resources`),
    ptero(`/api/client/servers/${serverId(server)}/network/allocations`),
  ]);
  const listing = listingResult.status === 'fulfilled' ? listingResult.value : null;
  const resources = resourcesResult.status === 'fulfilled' ? resourcesResult.value : null;
  const allocations = allocationsResult.status === 'fulfilled' ? allocationsResult.value?.data || [] : [];
  const allocation = allocations.find((item) => (item.attributes || item).is_default) || allocations[0];
  const allocationInfo = allocation?.attributes || allocation;
  const queryPort = Number(allocationInfo?.port) + 1;
  const playerCount = allocationInfo?.ip && Number.isInteger(queryPort)
    ? await queryValheim(allocationInfo.ip_alias || allocationInfo.ip, queryPort)
    : null;
  const entry = (listing?.data || []).map((item) => item.attributes || item).find((item) => item.name === 'maintenance');
  const effectiveAt = schedule?.effective_at ? new Date(schedule.effective_at) : null;
  const scheduled = Boolean(entry && entry.is_file !== false && effectiveAt && effectiveAt.getTime() > Date.now());
  return {
    server,
    enabled: listing ? Boolean(entry && entry.is_file !== false) : null,
    powerState: resources?.attributes?.current_state || 'unavailable',
    phase: scheduled ? 'scheduled' : entry && entry.is_file !== false ? 'active' : 'normal',
    scheduledAt: scheduled ? schedule.started_at : null,
    effectiveAt: scheduled ? schedule.effective_at : null,
    onlinePlayers: playerCount?.onlinePlayers ?? null,
    maxPlayers: playerCount?.maxPlayers ?? null,
  };
}

async function allStatuses(admin) {
  const { data: schedules, error } = await admin.from('server_maintenance_schedules').select('*');
  if (error) throw error;
  const byServer = new Map((schedules || []).map((schedule) => [schedule.server, schedule]));
  return Promise.all(SERVERS.map((server) => statusFor(server, byServer.get(server))));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  try {
    const { admin, profile, email } = await authenticate(req);
    const action = req.body?.action || 'status';
    if (action === 'status') return send(res, 200, { servers: await allStatuses(admin) });

    if (!['set', 'abort', 'power'].includes(action)) return send(res, 400, { error: 'Ação inválida.' });
    if (!ADMIN_ROLES.has(profile.role)) return send(res, 403, { error: 'Somente administradores podem alterar a manutenção.' });
    const server = req.body?.server;
    const enabled = req.body?.enabled;
    if (action === 'power') {
      const signal = req.body?.signal;
      if (!SERVERS.includes(server) || !['start', 'restart', 'stop'].includes(signal)) return send(res, 400, { error: 'Comando do servidor inválido.' });
      await ptero(`/api/client/servers/${serverId(server)}/power`, {
        method: 'POST', body: JSON.stringify({ signal }), contentType: 'application/json',
      });
      return send(res, 200, { servers: await allStatuses(admin) });
    }
    if (!['server_1', 'server_2', 'todos'].includes(server) || (action === 'set' && typeof enabled !== 'boolean')) return send(res, 400, { error: 'Dados de manutenção inválidos.' });

    const selectedServers = targets(server);
    const { data: schedules, error: scheduleError } = await admin.from('server_maintenance_schedules').select('*').in('server', selectedServers);
    if (scheduleError) throw scheduleError;
    const byServer = new Map((schedules || []).map((schedule) => [schedule.server, schedule]));
    const currentStatuses = await Promise.all(selectedServers.map((target) => statusFor(target, byServer.get(target))));
    const currentByServer = new Map(currentStatuses.map((status) => [status.server, status]));

    if (action === 'set' && enabled && currentStatuses.some((status) => status.enabled)) return send(res, 400, { error: 'Selecione apenas servidores sem manutenção para iniciar uma nova contagem.' });
    if (action === 'set' && !enabled && currentStatuses.some((status) => status.phase !== 'active')) return send(res, 400, { error: 'Use “Abortar manutenção” enquanto a contagem de 5 minutos estiver ativa.' });

    if (action === 'abort' && currentStatuses.some((status) => status.phase !== 'scheduled')) return send(res, 400, { error: 'A manutenção não possui uma contagem ativa que possa ser abortada.' });

    const now = new Date();
    const effectiveAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
    await Promise.all(selectedServers.map(async (target) => {
      const current = currentByServer.get(target);
      if (current.powerState !== 'running') throw new Error(`${target === 'server_1' ? 'Server 1' : 'Server 2'} precisa estar ligado para alterar a manutenção.`);
      if (action === 'set' && enabled && !current.enabled) {
        await ptero(`/api/client/servers/${serverId(target)}/files/write?file=${encodeURIComponent(`${CONFIG_ROOT}/maintenance`)}`, { method: 'POST', body: '', contentType: 'text/plain' });
      }
      if ((action === 'abort' || (action === 'set' && !enabled)) && current.enabled) {
        await ptero(`/api/client/servers/${serverId(target)}/files/delete`, { method: 'POST', body: JSON.stringify({ root: CONFIG_ROOT, files: ['maintenance'] }), contentType: 'application/json' });
      }
    }));

    if (action === 'set' && enabled) {
      const { error } = await admin.from('server_maintenance_schedules').upsert(selectedServers.map((target) => ({ server: target, started_at: now.toISOString(), effective_at: effectiveAt, created_by: email, status: 'scheduled' })));
      if (error) throw error;
    } else {
      const { error } = await admin.from('server_maintenance_schedules').delete().in('server', selectedServers);
      if (error) throw error;
    }

    return send(res, 200, { servers: await allStatuses(admin) });
  } catch (error) {
    return send(res, error.status || 500, { error: error.message || 'Falha ao alterar a manutenção.' });
  }
}
