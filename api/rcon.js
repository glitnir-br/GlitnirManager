import net from 'node:net';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_RCON_ROLES = new Set(['adm_principal', 'administrador']);
const MAX_COMMAND_LENGTH = 1000;

function send(res, status, body) { res.status(status).json(body); }
function validServer(server) { return server === 'server_1' || server === 'server_2'; }
function configFor(server) {
  const suffix = server === 'server_1' ? '1' : '2';
  return { host: process.env[`RCON_SERVER_${suffix}_HOST`], port: Number(process.env[`RCON_SERVER_${suffix}_PORT`]), password: process.env[`RCON_SERVER_${suffix}_PASSWORD`] };
}
function packet(id, type, payload) {
  const content = Buffer.from(payload, 'utf8'); const result = Buffer.alloc(content.length + 14);
  result.writeInt32LE(content.length + 10, 0); result.writeInt32LE(id, 4); result.writeInt32LE(type, 8); content.copy(result, 12); result.writeInt16LE(0, result.length - 2);
  return result;
}
function packets(buffer) {
  const result = []; let offset = 0;
  while (offset + 4 <= buffer.length) {
    const size = buffer.readInt32LE(offset);
    if (size < 10 || offset + size + 4 > buffer.length) break;
    result.push({ id: buffer.readInt32LE(offset + 4), type: buffer.readInt32LE(offset + 8), body: buffer.subarray(offset + 12, offset + size + 2).toString('utf8') });
    offset += size + 4;
  }
  return { result, remaining: buffer.subarray(offset) };
}
async function authenticate(req) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
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
  const allowed = profile.role === 'adm_principal' || (permissions?.length ? permissions.some((item) => item.page_key === 'rcon' && item.allowed) : DEFAULT_RCON_ROLES.has(profile.role));
  if (!allowed) throw Object.assign(new Error('Seu cargo não possui permissão para usar Rcon.'), { status: 403 });
  return { email: data.user.email };
}
function executeRcon(server, command) {
  const config = configFor(server);
  if (!config.host || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535 || !config.password) throw Object.assign(new Error(`RCON do ${server === 'server_1' ? 'Server 1' : 'Server 2'} não está configurado.`), { status: 503 });
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: config.host, port: config.port }); let buffer = Buffer.alloc(0); let authenticated = false; let output = ''; let idleTimer; let settled = false;
    const finish = (error) => { if (settled) return; settled = true; clearTimeout(idleTimer); socket.destroy(); error ? reject(error) : resolve(output.trim() || 'Comando executado sem resposta.'); };
    const resetIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => finish(), 600); };
    socket.setTimeout(10_000, () => finish(Object.assign(new Error('Tempo limite da conexão RCON excedido.'), { status: 504 })));
    socket.on('connect', () => socket.write(packet(1, 3, config.password)));
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]); const parsed = packets(buffer); buffer = parsed.remaining;
      for (const response of parsed.result) {
        if (!authenticated) {
          if (response.id === -1) return finish(Object.assign(new Error('Senha RCON recusada pelo servidor.'), { status: 502 }));
          if (response.id === 1) { authenticated = true; socket.write(packet(2, 2, command)); resetIdle(); }
        } else if (response.id === 2) { output += response.body; resetIdle(); }
      }
    });
    socket.on('error', (error) => finish(Object.assign(new Error(`Não foi possível conectar ao RCON: ${error.message}`), { status: 502 })));
    socket.on('close', () => { if (!settled) authenticated ? finish() : finish(Object.assign(new Error('Conexão RCON encerrada antes da autenticação.'), { status: 502 })); });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  try {
    const actor = await authenticate(req); const server = req.body?.server; const command = String(req.body?.command || '').trim();
    if (!validServer(server)) return send(res, 400, { error: 'Servidor inválido.' });
    if (!command || command.length > MAX_COMMAND_LENGTH || /[\r\n\0]/.test(command)) return send(res, 400, { error: 'Comando inválido.' });
    const output = await executeRcon(server, command);
    console.info('RCON command', { actor: actor.email, server, command: command.split(' ')[0], at: new Date().toISOString() });
    return send(res, 200, { output, executedAt: new Date().toISOString() });
  } catch (error) { return send(res, error.status || 500, { error: error.message || 'Falha ao executar comando RCON.' }); }
}
