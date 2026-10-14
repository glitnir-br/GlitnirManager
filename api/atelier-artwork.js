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
