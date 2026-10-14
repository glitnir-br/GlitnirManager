import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };

const ARTWORK_PATH = '/BepInEx/config/GlitnirGuildAtelier/Artwork';
const BUCKET = 'atelier-artwork';
const TABLE = 'atelier_artworks';
const ALLOWED_ROLES = new Set(['adm_principal', 'administrador']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
const MAX_FILE_SIZE = 8 * 1024 * 1024;

function send(res, status, body) { res.status(status).json(body); }
function serverId(server) { return process.env[server === 'server_1' ? 'PTERODACTYL_SERVER_1_ID' : 'PTERODACTYL_SERVER_2_ID']; }
function targets(server) { return server === 'todos' ? ['server_1', 'server_2'] : [server]; }
function isImageName(name) { return IMAGE_EXTENSIONS.has(name.split('.').pop()?.toLowerCase()); }
function contentType(name) {
  const extension = name.split('.').pop().toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' }[extension] || `image/${extension}`;
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  return { time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2), date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate() };
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const content = file.content;
    const crc = crc32(content);
    const { time, date } = dosDateTime();
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034B50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8); local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(content.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    localParts.push(local, name, content);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014B50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(0, 10); central.writeUInt16LE(time, 12); central.writeUInt16LE(date, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(content.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + content.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054B50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, end]);
}

async function pterodactylRequest(path, responseType = 'json', options = {}) {
  const baseUrl = process.env.PTERODACTYL_URL?.replace(/\/$/, '');
  const apiKey = process.env.PTERODACTYL_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('Configuração do Pterodactyl incompleta.');
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET', body: options.body,
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', ...(options.contentType ? { 'Content-Type': options.contentType } : {}) },
  });
  if (!response.ok) throw new Error(`Pterodactyl respondeu ${response.status}: ${(await response.text()).slice(0, 300)}`);
  if (responseType === 'text') return response.text();
  if (responseType === 'buffer') return response.arrayBuffer();
  return response.json();
}

async function listServer(server) {
  const id = serverId(server);
  if (!id) throw new Error(`ID do ${server} não configurado.`);
  const listing = await pterodactylRequest(`/api/client/servers/${id}/files/list?directory=${encodeURIComponent(ARTWORK_PATH)}`);
  return (listing.data || []).map((entry) => entry.attributes || entry)
    .filter((file) => file.is_file !== false && isImageName(file.name || ''))
    .map((file) => ({ name: file.name, size: file.size || 0 }));
}

async function ensureBucket(admin) {
  const { data: bucket, error } = await admin.storage.getBucket(BUCKET);
  if (error && !/not found/i.test(error.message || '')) throw error;
  if (!bucket) {
    const { error: createError } = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: String(MAX_FILE_SIZE), allowedMimeTypes: [...new Set([...IMAGE_EXTENSIONS].map((extension) => contentType(`file.${extension}`)))] });
    if (createError && !/already exists/i.test(createError.message || '')) throw createError;
  }
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
  return { admin, userEmail: data.user.email };
}

async function cachedFiles(admin) {
  const { data: files, error } = await admin.from(TABLE).select('name,servers,size,storage_path').order('name');
  if (error) throw error;
  return Promise.all((files || []).map(async (file) => {
    const { data, error: urlError } = await admin.storage.from(BUCKET).createSignedUrl(file.storage_path, 3600);
    return { name: file.name, servers: file.servers || [], size: file.size || 0, previewUrl: urlError ? null : data?.signedUrl || null };
  }));
}

async function copyToStorage(admin, name, sourceServer) {
  const id = serverId(sourceServer);
  const content = await pterodactylRequest(`/api/client/servers/${id}/files/contents?file=${encodeURIComponent(`${ARTWORK_PATH}/${name}`)}`, 'buffer');
  const { error } = await admin.storage.from(BUCKET).upload(name, Buffer.from(content), { contentType: contentType(name), upsert: true, cacheControl: '3600' });
  if (error) throw error;
}

async function syncArtwork(admin) {
  await ensureBucket(admin);
  const [server1, server2, existingResult] = await Promise.all([listServer('server_1'), listServer('server_2'), admin.from(TABLE).select('name,servers,storage_path')]);
  if (existingResult.error) throw existingResult.error;
  const merged = new Map();
  for (const [server, files] of [['server_1', server1], ['server_2', server2]]) for (const file of files) {
    const item = merged.get(file.name) || { name: file.name, servers: [], size: file.size, sourceServer: server };
    item.servers.push(server); item.size = Math.max(item.size, file.size); merged.set(file.name, item);
  }
  const existing = new Map((existingResult.data || []).map((file) => [file.name, file]));
  for (const item of merged.values()) {
    if (!existing.has(item.name)) await copyToStorage(admin, item.name, item.sourceServer);
    const { error } = await admin.from(TABLE).upsert({ name: item.name, servers: item.servers, size: item.size, storage_path: item.name, synced_at: new Date().toISOString() }, { onConflict: 'name' });
    if (error) throw error;
  }
  const removed = [...existing.values()].filter((file) => !merged.has(file.name));
  if (removed.length) {
    const { error: storageError } = await admin.storage.from(BUCKET).remove(removed.map((file) => file.storage_path));
    if (storageError) throw storageError;
    const { error: deleteError } = await admin.from(TABLE).delete().in('name', removed.map((file) => file.name));
    if (deleteError) throw deleteError;
  }
  return { total: merged.size, copied: [...merged.keys()].filter((name) => !existing.has(name)).length, removed: removed.length };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'Método não permitido.' }); }
  try {
    const { admin, userEmail } = await authenticate(req);
    const action = req.body?.action || 'list';
    if (action === 'list') return send(res, 200, { files: await cachedFiles(admin) });
    if (action === 'sync') return send(res, 200, { ...(await syncArtwork(admin)), files: await cachedFiles(admin) });
    if (action === 'download' || action === 'download-all') {
      const requestedName = String(req.body?.name || '').trim();
      if (action === 'download' && (!requestedName || !isImageName(requestedName))) return send(res, 400, { error: 'Informe uma imagem válida para download.' });
      const { data: records, error } = await admin.from(TABLE).select('name,storage_path').order('name');
      if (error) throw error;
      const selected = action === 'download' ? (records || []).filter((file) => file.name === requestedName) : records || [];
      if (!selected.length) return send(res, 404, { error: 'Imagem não encontrada no armazenamento.' });
      const files = await Promise.all(selected.map(async (file) => {
        const { data, error: storageError } = await admin.storage.from(BUCKET).download(file.storage_path);
        if (storageError) throw storageError;
        return { name: file.name, content: Buffer.from(await data.arrayBuffer()) };
      }));
      if (action === 'download') {
        res.setHeader('Content-Type', contentType(files[0].name));
        res.setHeader('Content-Disposition', `attachment; filename="${files[0].name.replace(/"/g, '')}"`);
        return res.status(200).send(files[0].content);
      }
      const archive = createZip(files);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="atelier-artwork.zip"');
      return res.status(200).send(archive);
    }
    const server = req.body?.server;
    if (!['server_1', 'server_2', 'todos'].includes(server)) return send(res, 400, { error: 'Servidor inválido.' });
    const name = String(req.body?.name || '').trim();
    if (!name || name !== name.split(/[\\/]/).pop() || !isImageName(name)) return send(res, 400, { error: 'Informe um arquivo de imagem válido.' });
    const selectedServers = targets(server);
    await ensureBucket(admin);
    if (action === 'delete') {
      await Promise.all(selectedServers.map(async (target) => {
        const id = serverId(target); if (!id) throw new Error(`ID do ${target} não configurado.`);
        await pterodactylRequest(`/api/client/servers/${id}/files/delete`, 'json', { method: 'POST', body: JSON.stringify({ root: ARTWORK_PATH, files: [name] }), contentType: 'application/json' });
      }));
      const { data: existing, error } = await admin.from(TABLE).select('servers,storage_path').eq('name', name).maybeSingle();
      if (error) throw error;
      const servers = (existing?.servers || []).filter((item) => !selectedServers.includes(item));
      if (servers.length) {
        const { error: updateError } = await admin.from(TABLE).update({ servers, synced_at: new Date().toISOString() }).eq('name', name);
        if (updateError) throw updateError;
      } else {
        if (existing?.storage_path) { const { error: storageError } = await admin.storage.from(BUCKET).remove([existing.storage_path]); if (storageError) throw storageError; }
        const { error: deleteError } = await admin.from(TABLE).delete().eq('name', name); if (deleteError) throw deleteError;
      }
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
      const { error: storageError } = await admin.storage.from(BUCKET).upload(name, buffer, { contentType: mime, upsert: true, cacheControl: '3600' });
      if (storageError) throw storageError;
      const { data: existing, error } = await admin.from(TABLE).select('servers').eq('name', name).maybeSingle();
      if (error) throw error;
      const servers = [...new Set([...(existing?.servers || []), ...selectedServers])];
      const { error: upsertError } = await admin.from(TABLE).upsert({ name, servers, size: buffer.length, storage_path: name, synced_at: new Date().toISOString() }, { onConflict: 'name' });
      if (upsertError) throw upsertError;
    } else return send(res, 400, { error: 'Ação inválida.' });
    return send(res, 200, { success: true, server, name, userEmail, files: await cachedFiles(admin) });
  } catch (error) {
    console.error('Falha ao gerenciar imagens do Atelier:', error);
    return send(res, error.status || 500, { error: error.message || 'Falha ao gerenciar imagens do Atelier.' });
  }
}
