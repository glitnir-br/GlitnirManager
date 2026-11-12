import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };
const ROOTS = { plugins: '/BepInEx/plugins', whitelist: '/BepInEx/config/AzuAntiCheat/Whitelist', greylist: '/BepInEx/config/AzuAntiCheat/Greylist' };
const ROLES = new Set(['adm_principal', 'administrador']);
const MAX = 8 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set(['txt', 'json', 'md', 'yml', 'yaml', 'cfg', 'conf', 'ini', 'log', 'xml', 'csv', 'properties']);
function territoryName(value) { const name = String(value || '').trim(); if (!name || name.length > 80 || /[\\/:*?"<>|\[\]\r\n]/.test(name)) { const error = new Error('Nome inválido. Não use /, \\, :, *, ?, aspas, colchetes ou quebras de linha.'); error.status = 400; throw error; } return name; }
function send(res, status, body) { res.status(status).json(body); }
function id(server) { return process.env[server === 'server_1' ? 'PTERODACTYL_SERVER_1_ID' : 'PTERODACTYL_SERVER_2_ID']; }
function targets(server) { return server === 'todos' ? ['server_1', 'server_2'] : [server]; }
function safe(path) { return !path.includes('..') && !path.startsWith('/') && !path.includes('\\'); }
function full(category, path = '') { return path ? `${ROOTS[category]}/${path}` : ROOTS[category]; }
async function ptero(path, options = {}) { const base = process.env.PTERODACTYL_URL?.replace(/\/$/, ''); const key = process.env.PTERODACTYL_API_KEY; if (!base || !key) throw new Error('Configuração do Pterodactyl incompleta.'); const response = await fetch(`${base}${path}`, { method: options.method || 'GET', body: options.body, headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(options.contentType ? { 'Content-Type': options.contentType } : {}) } }); if (!response.ok) throw new Error(`Pterodactyl respondeu ${response.status}: ${(await response.text()).slice(0, 250)}`); const content = await response.text(); if (options.text) return content; return content ? JSON.parse(content) : null; }
async function auth(req) { const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY; if (!url || !key) throw new Error('Configuração do Supabase incompleta.'); const token = req.headers.authorization?.replace(/^Bearer\s+/i, ''); if (!token) { const e = new Error('Autenticação necessária.'); e.status = 401; throw e; } const admin = createClient(url, key, { auth: { persistSession: false } }); const { data, error } = await admin.auth.getUser(token); if (error || !data.user?.email) { const e = new Error('Sessão inválida.'); e.status = 401; throw e; } const { data: profile } = await admin.from('user_profiles').select('role,status').eq('email', data.user.email).maybeSingle(); if (!profile || !['ativo', 'aprovado'].includes(profile.status) || !ROLES.has(profile.role)) { const e = new Error('Somente administradores podem gerenciar estes arquivos.'); e.status = 403; throw e; } return admin; }
async function tree(server, category, directory = '', result = []) { const listing = await ptero(`/api/client/servers/${id(server)}/files/list?directory=${encodeURIComponent(full(category, directory))}`); for (const entry of listing.data || []) { const file = entry.attributes || entry; const path = directory ? `${directory}/${file.name}` : file.name; result.push({ path, isDirectory: file.is_file === false, size: file.size || 0 }); if (file.is_file === false) await tree(server, category, path, result); } return result; }
async function sync(admin, category) { const [one, two] = await Promise.all([tree('server_1', category), tree('server_2', category)]); const map = new Map(); for (const [server, files] of [['server_1', one], ['server_2', two]]) for (const file of files) { const item = map.get(file.path) || { category, path: file.path, is_directory: file.isDirectory, size: file.size, servers: [] }; item.servers.push(server); item.size = Math.max(item.size, file.size); map.set(file.path, item); }
  const { error: clearError } = await admin.from('server_files').delete().eq('category', category); if (clearError) throw clearError;
  const values = [...map.values()]; if (values.length) { const { error } = await admin.from('server_files').insert(values); if (error) throw error; }
  const { error } = await admin.from('server_file_syncs').upsert({ category, synced_at: new Date().toISOString() }, { onConflict: 'category' }); if (error) throw error;
}
async function syncMods(admin) {
  const { data: files, error } = await admin.from('server_files').select('category,path,servers,is_directory');
  if (error) throw error;
  const manifestFiles = new Map();
  for (const file of files || []) if (!file.is_directory && /^manifest(?:\.json)?$/i.test(file.path.split('/').pop() || '')) {
    const folderName = file.path.split('/')[0];
    for (const server of file.servers || []) manifestFiles.set(`${server}:${file.category}:${folderName.toLowerCase()}`, file.path);
  }
  const records = [];
  const folders = (files || []).filter((file) => file.is_directory && !file.path.includes('/') && file.path.includes('-'));
  for (const folder of folders) for (const server of folder.servers || []) {
    const folderName = folder.path;
    const separator = folderName.indexOf('-');
    const creator = folderName.slice(0, separator).trim() || 'Não informado';
    const fallbackName = folderName.slice(separator + 1).trim() || folderName;
    const manifestPath = manifestFiles.get(`${server}:${folder.category}:${folderName.toLowerCase()}`);
    let name = fallbackName;
    let version = 'Versão indisponível';
    let valid = false;
    try {
      if (!manifestPath) throw new Error('Manifest não encontrado');
      const content = await ptero(`/api/client/servers/${id(server)}/files/contents?file=${encodeURIComponent(full(folder.category, manifestPath))}`, { text: true });
      const json = JSON.parse(content);
      if (typeof json.name === 'string' && typeof json.version_number === 'string') {
        name = json.name.trim(); version = json.version_number.trim(); valid = Boolean(name && version);
      }
    } catch (readError) { console.warn(`Manifest não lido: ${folder.category}/${folderName}`, readError.message); }
    records.push({ package_key: folderName.toLowerCase(), folder_name: folderName, name, version, creator, category: folder.category, server, manifest_path: manifestPath || `${folderName}/manifest.json`, manifest_valid: valid });
  }
  const { error: clearError } = await admin.from('server_mod_manifests').delete().neq('name', ''); if (clearError) throw clearError;
  if (records.length) { const { error: insertError } = await admin.from('server_mod_manifests').insert(records); if (insertError) throw insertError; }
}
async function mkdir(server, category, folder) {
  if (!folder) return;
  const parts = folder.split('/').filter(Boolean);
  let parentPath = '';
  for (const part of parts) {
    const directory = full(category, parentPath);
    const listing = await ptero(`/api/client/servers/${id(server)}/files/list?directory=${encodeURIComponent(directory)}`);
    const existing = (listing.data || []).map((entry) => entry.attributes || entry).find((entry) => entry.name === part);
    if (existing) {
      if (existing.is_file !== false) throw new Error(`Já existe um arquivo chamado "${part}" em ${directory}.`);
    } else {
      await ptero(`/api/client/servers/${id(server)}/files/create-folder`, { method: 'POST', body: JSON.stringify({ root: directory, name: part }), contentType: 'application/json' });
    }
    parentPath = parentPath ? `${parentPath}/${part}` : part;
  }
}
export default async function handler(req, res) { if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' }); try { const admin = await auth(req); const action = req.body?.action || 'list'; const category = req.body?.category;
  if (action.startsWith('territory-')) {
    const server = req.body?.server; if (!['server_1', 'server_2'].includes(server)) return send(res, 400, { error: 'Selecione Server 1 ou Server 2.' });
    const territoryRoot = '/BepInEx/config/Marketplace/Configs/Territories';
    if (action === 'territory-list') { const inventories = await Promise.all(targets(server).map(async (target) => { try { const listing = await ptero(`/api/client/servers/${id(target)}/files/list?directory=${encodeURIComponent(territoryRoot)}`); const files = (listing.data || []).map((entry) => entry.attributes || entry).filter((entry) => entry.is_file !== false && entry.name.endsWith('.cfg')); return { target, files: await Promise.all(files.map(async (entry) => ({ name: entry.name, content: await ptero(`/api/client/servers/${id(target)}/files/contents?file=${encodeURIComponent(`${territoryRoot}/${entry.name}`)}`, { text: true }) }))) }; } catch { return { target, files: [] }; } })); return send(res, 200, { files: inventories.flatMap((inventory) => inventory.files.map((file) => ({ ...file, server: inventory.target }))) }); }
    if (action === 'territory-write-file') { const base = territoryName(String(req.body?.file || '').replace(/\.cfg$/i, '')); const content = String(req.body?.content || ''); if (!content.trim() || content.length > 100_000) return send(res, 400, { error: 'Configuração do arquivo inválida.' }); await ptero(`/api/client/servers/${id(server)}/files/write?file=${encodeURIComponent(`${territoryRoot}/${base}.cfg`)}`, { method: 'POST', body: content, contentType: 'text/plain', text: true }); return send(res, 200, { success: true }); }
    if (action === 'territory-delete-file') { const base = territoryName(String(req.body?.file || '').replace(/\.cfg$/i, '')); await ptero(`/api/client/servers/${id(server)}/files/delete`, { method: 'POST', body: JSON.stringify({ root: territoryRoot, files: [`${base}.cfg`] }), contentType: 'application/json' }); return send(res, 200, { success: true }); }
    const name = territoryName(req.body?.name); const file = `${name}.cfg`;
    if (action === 'territory-read') { const content = await ptero(`/api/client/servers/${id(server)}/files/contents?file=${encodeURIComponent(`${territoryRoot}/${file}`)}`, { text: true }); return send(res, 200, { content }); }
    if (action === 'territory-save') { const content = String(req.body?.content || ''); if (!content.startsWith(`[${name}`) || content.length > 20_000) return send(res, 400, { error: 'Configuração do território inválida.' }); await ptero(`/api/client/servers/${id(server)}/files/write?file=${encodeURIComponent(`${territoryRoot}/${file}`)}`, { method: 'POST', body: content, contentType: 'text/plain', text: true }); return send(res, 200, { success: true }); }
    if (action === 'territory-delete') { await Promise.all(targets(server).map((target) => ptero(`/api/client/servers/${id(target)}/files/delete`, { method: 'POST', body: JSON.stringify({ root: territoryRoot, files: [file] }), contentType: 'application/json' }))); return send(res, 200, { success: true }); }
    return send(res, 400, { error: 'Ação inválida.' });
  }
  if (action === 'sync-all') { await Promise.all(Object.keys(ROOTS).map((item) => sync(admin, item))); await syncMods(admin); return send(res, 200, { success: true }); } if (action === 'list' && category === 'mods') { const { data: rows, error } = await admin.from('server_mod_manifests').select('*').order('folder_name'); if (error) throw error; const grouped = new Map(); for (const row of rows || []) { const mod = grouped.get(row.package_key) || { packageKey: row.package_key, folderName: row.folder_name, names: new Set(), authors: new Set(), versions: new Map(), servers: new Set(), locations: new Set(), invalidManifest: false }; const versionKey = `${row.name}\0${row.version}`; const version = mod.versions.get(versionKey) || { name: row.name, version: row.version, servers: new Set(), locations: new Set() }; version.servers.add(row.server); version.locations.add(row.category); mod.names.add(row.name); mod.authors.add(row.creator || 'Não informado'); mod.versions.set(versionKey, version); mod.servers.add(row.server); mod.locations.add(row.category); mod.invalidManifest ||= row.manifest_valid === false; grouped.set(row.package_key, mod); } const mods = [...grouped.values()].map((mod) => ({ packageKey: mod.packageKey, folderName: mod.folderName, name: [...mod.names][0] || mod.folderName, names: [...mod.names], authors: [...mod.authors], versions: [...mod.versions.values()].map((version) => ({ name: version.name, version: version.version, servers: [...version.servers], locations: [...version.locations] })), servers: [...mod.servers], locations: [...mod.locations], divergent: mod.versions.size > 1 || mod.invalidManifest, invalidManifest: mod.invalidManifest })); const { data: syncInfo } = await admin.from('server_file_syncs').select('synced_at').order('synced_at', { ascending: false }).limit(1).maybeSingle(); return send(res, 200, { files: mods, syncedAt: syncInfo?.synced_at || null }); } if (!ROOTS[category]) return send(res, 400, { error: 'Categoria inválida.' }); if (action === 'sync') { await sync(admin, category); }
  if (action === 'list' || action === 'sync') { const path = String(req.body?.path || ''); if (!safe(path)) return send(res, 400, { error: 'Caminho inválido.' }); const parent = path ? `${path}/` : ''; const { data: rows, error } = await admin.from('server_files').select('*').eq('category', category).order('is_directory', { ascending: false }).order('path'); if (error) throw error; const files = (rows || []).filter((row) => row.path.startsWith(parent) && !row.path.slice(parent.length).includes('/')); const { data: syncInfo } = await admin.from('server_file_syncs').select('synced_at').eq('category', category).maybeSingle(); return send(res, 200, { files, syncedAt: syncInfo?.synced_at || null }); }
  const server = req.body?.server; if (!['server_1', 'server_2', 'todos'].includes(server)) return send(res, 400, { error: 'Servidor inválido.' });
  if (action === 'read') { const filePath = String(req.body?.path || ''); const fileExtension = filePath.split('.').pop()?.toLowerCase(); if (!safe(filePath) || !TEXT_EXTENSIONS.has(fileExtension) || server === 'todos') return send(res, 400, { error: 'Selecione um arquivo de texto e um servidor válido.' }); const content = await ptero(`/api/client/servers/${id(server)}/files/contents?file=${encodeURIComponent(full(category, filePath))}`, { text: true }); if (content.length > 1024 * 1024) return send(res, 413, { error: 'O arquivo é grande demais para pré-visualização (limite de 1 MB).' }); return send(res, 200, { content }); }
  const selected = targets(server);
  if (action === 'check-conflicts') {
    const paths = req.body?.paths || [];
    if (!Array.isArray(paths) || !paths.length || paths.some((path) => !safe(path))) return send(res, 400, { error: 'Seleção inválida.' });
    const inventories = await Promise.all(selected.map(async (target) => ({ target, files: await tree(target, category) })));
    const conflicts = paths.flatMap((filePath) => {
      const occurrences = inventories.flatMap(({ target, files }) => {
        const match = files.find((file) => file.path === filePath);
        return match ? [{ server: target, isDirectory: match.isDirectory }] : [];
      });
      return occurrences.length ? [{ path: filePath, servers: occurrences.map((item) => item.server), isDirectory: occurrences.some((item) => item.isDirectory) }] : [];
    });
    return send(res, 200, { conflicts });
  }
  if (action === 'upload') { const files = req.body?.files || []; if (!Array.isArray(files) || !files.length) return send(res, 400, { error: 'Selecione os arquivos.' }); for (const file of files) { if (!safe(file.path || '') || !file.contentBase64) return send(res, 400, { error: 'Arquivo inválido.' }); const content = Buffer.from(file.contentBase64, 'base64'); if (!content.length || content.length > MAX) return send(res, 400, { error: 'Cada arquivo deve ter no máximo 8 MB.' }); await Promise.all(selected.map(async (target) => { await mkdir(target, category, file.path.split('/').slice(0, -1).join('/')); await ptero(`/api/client/servers/${id(target)}/files/write?file=${encodeURIComponent(full(category, file.path))}`, { method: 'POST', body: content, contentType: file.mime || 'application/octet-stream', text: true }); })); } }
  if (action === 'create-folder') { const folder = String(req.body?.path || ''); if (!safe(folder) || !folder) return send(res, 400, { error: 'Nome da pasta inválido.' }); await Promise.all(selected.map((target) => mkdir(target, category, folder))); }
  if (action === 'delete') { const paths = req.body?.paths || []; if (!Array.isArray(paths) || !paths.length || paths.some((path) => !safe(path))) return send(res, 400, { error: 'Seleção inválida.' }); await Promise.all(selected.map(async (target) => { for (const path of paths) await ptero(`/api/client/servers/${id(target)}/files/delete`, { method: 'POST', body: JSON.stringify({ root: ROOTS[category], files: [path] }), contentType: 'application/json' }); })); }
  await sync(admin, category); return send(res, 200, { success: true });
} catch (error) { return send(res, error.status || 500, { error: error.message || 'Falha ao gerenciar arquivos.' }); } }
