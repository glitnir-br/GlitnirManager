import { createClient } from '@supabase/supabase-js';
import vanillaCatalog from '../src/data/valheim-item-catalog.json' with { type: 'json' };
import modpackCatalog from '../src/data/glitnir-prefab-catalog.json' with { type: 'json' };
import { executeRcon } from './rcon.js';

const DEFAULT_ROLES = new Set(['adm_principal', 'administrador']);
const catalog = new Map([...Object.values(vanillaCatalog), ...Object.values(modpackCatalog)].filter((item) => item?.prefab).map((item) => [item.prefab, item]));
const send = (res, status, body) => res.status(status).json(body);
const validServer = (value) => value === 'server_1' || value === 'server_2';

async function context(req, capabilities = ['vip_history']) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw Object.assign(new Error('Configuração do Supabase incompleta.'), { status: 500 });
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, ''); if (!token) throw Object.assign(new Error('Autenticação necessária.'), { status: 401 });
  const admin = createClient(url, key, { auth: { persistSession: false } }); const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email) throw Object.assign(new Error('Sessão inválida.'), { status: 401 });
  const { data: profile } = await admin.from('user_profiles').select('role,status').eq('email', data.user.email).maybeSingle();
  if (!profile || !['ativo', 'aprovado'].includes(profile.status)) throw Object.assign(new Error('Usuário sem acesso ativo.'), { status: 403 });
  const { data: permissions } = await admin.from('role_permissions').select('page_key,allowed').eq('role_key', profile.role);
  const required = Array.isArray(capabilities) ? capabilities : [capabilities];
  const allowed = profile.role === 'adm_principal' || (permissions?.length ? permissions.some((item) => required.includes(item.page_key) && item.allowed) : DEFAULT_ROLES.has(profile.role));
  if (!allowed) throw Object.assign(new Error('Seu cargo não possui esta permissão VIP.'), { status: 403 });
  return { admin, email: data.user.email };
}
function validatedItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw Object.assign(new Error('O pacote deve possuir itens.'), { status: 400 });
  const seen = new Set();
  return items.map((item, index) => {
    const known = catalog.get(String(item.prefab || '')); const quantity = Number(item.quantity); const quality = Number(item.quality || 1); const key = `${item.prefab}:${quality}`;
    if (!known) throw Object.assign(new Error(`Prefab inválido: ${item.prefab || '-'}.`), { status: 400 });
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000 || !Number.isInteger(quality) || quality < 1 || (known.maxQuality && quality > known.maxQuality)) throw Object.assign(new Error(`Quantidade ou qualidade inválida para ${item.prefab}.`), { status: 400 });
    if (seen.has(key)) throw Object.assign(new Error(`Item duplicado: ${item.prefab} qualidade ${quality}.`), { status: 400 }); seen.add(key);
    return { friendly_name: known.english || known.token || known.prefab, prefab: known.prefab, quantity, quality, sort_order: index };
  });
}
function playerIsOnline(output, steamid) { const value = String(output || '').toLowerCase(); return value.includes(steamid.toLowerCase()) && !/(not found|no player|offline|não encontrado)/i.test(value); }
async function processDelivery(admin, delivery) {
  const { data: claimed } = await admin.from('vip_deliveries').update({ status: 'em_processamento', started_at: new Date().toISOString() }).eq('id', delivery.id).in('status', ['pendente', 'aguardando_online']).select().maybeSingle();
  if (!claimed) throw Object.assign(new Error('Esta entrega já foi processada ou não pode ser enviada novamente.'), { status: 409 });
  const { data: items } = await admin.from('vip_delivery_items').select('*').eq('delivery_id', delivery.id).order('sort_order');
  for (const item of items || []) {
    const command = `give ${delivery.steamid} ${item.prefab} -count ${item.quantity} -quality ${item.quality}`;
    await admin.from('vip_delivery_items').update({ status: 'em_processamento', command, attempted_at: new Date().toISOString() }).eq('id', item.id).eq('status', 'pendente');
    try {
      const response = await executeRcon(delivery.server, command); const failed = /(error|failed|not found|offline|invalid|exception)/i.test(response); const uncertain = response === 'Comando executado sem resposta.';
      await admin.from('vip_delivery_items').update({ status: uncertain ? 'resultado_incerto' : failed ? 'falhou' : 'entregue', response, completed_at: new Date().toISOString() }).eq('id', item.id);
    } catch (error) { await admin.from('vip_delivery_items').update({ status: 'resultado_incerto', error: error.message, completed_at: new Date().toISOString() }).eq('id', item.id); }
  }
  const { data: finalItems } = await admin.from('vip_delivery_items').select('status').eq('delivery_id', delivery.id); const statuses = finalItems.map((item) => item.status);
  const status = statuses.includes('resultado_incerto') ? 'resultado_incerto' : statuses.every((value) => value === 'entregue') ? 'concluida' : statuses.some((value) => value === 'entregue') ? 'parcial' : 'falhou';
  await admin.from('vip_deliveries').update({ status, completed_at: new Date().toISOString() }).eq('id', delivery.id);
  return status;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  try {
    const action = req.body?.action || 'list-deliveries'; const capabilities = ['save-package', 'toggle-package'].includes(action) ? ['vip_manage_packages'] : action === 'delete-financial' ? ['vip_finance'] : action === 'revoke-vip' ? ['vip_deliveries'] : action === 'list-packages' ? ['vip_manage_packages', 'vip_deliveries', 'vip_history'] : action === 'list-deliveries' ? ['vip_history', 'vip_deliveries', 'vip_finance'] : ['vip_deliveries']; const { admin, email } = await context(req, capabilities);
    if (action === 'list-packages') { const { data, error } = await admin.from('vip_packages').select('*, vip_package_items(*)').order('created_at', { ascending: false }); if (error) throw error; return send(res, 200, { packages: data }); }
    if (action === 'save-package') { const id = req.body?.id; const name = String(req.body?.name || '').trim(); const price = String(req.body?.price || '').replace(',', '.'); const items = validatedItems(req.body?.items); if (!name || !/^\d+(\.\d{1,2})?$/.test(price)) return send(res, 400, { error: 'Nome ou preço inválido.' }); let packageId = id; if (id) { const { error } = await admin.from('vip_packages').update({ name, description: req.body?.description || null, price, active: req.body?.active !== false, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; await admin.from('vip_package_items').delete().eq('package_id', id); } else { const { data, error } = await admin.from('vip_packages').insert({ name, description: req.body?.description || null, price, active: true, created_by: email }).select().single(); if (error) throw error; packageId = data.id; } const { error } = await admin.from('vip_package_items').insert(items.map((item) => ({ package_id: packageId, ...item, max_quality: catalog.get(item.prefab)?.maxQuality || null }))); if (error) throw error; return send(res, 200, { success: true }); }
    if (action === 'toggle-package') { const { error } = await admin.from('vip_packages').update({ active: Boolean(req.body?.active), updated_at: new Date().toISOString() }).eq('id', req.body?.id); if (error) throw error; return send(res, 200, { success: true }); }
    if (action === 'revoke-vip') { const id = req.body?.id; const reason = String(req.body?.reason || '').trim(); if (!id || !reason) return send(res, 400, { error: 'Informe o motivo da remoção do VIP.' }); const { data: membership, error } = await admin.from('vip_memberships').update({ active: false, revoked_at: new Date().toISOString(), revoked_by: email, revocation_reason: reason }).eq('delivery_id', id).eq('active', true).select('id').maybeSingle(); if (error) throw error; if (!membership) return send(res, 409, { error: 'Este VIP já foi removido.' }); await admin.from('security_logs').insert({ action: 'vip_membership_revoked', user_email: email, performed_by: email, details: JSON.stringify({ delivery_id: id, reason }) }); return send(res, 200, { success: true }); }
    if (action === 'delete-financial') { const id = req.body?.id; const { data: delivery, error: findError } = await admin.from('vip_deliveries').select('financial_id').eq('id', id).single(); if (findError) throw findError; if (!delivery.financial_id) return send(res, 409, { error: 'Este lançamento financeiro já foi excluído.' }); const financialId = delivery.financial_id; const { error: unlinkError } = await admin.from('vip_deliveries').update({ financial_id: null }).eq('id', id); if (unlinkError) throw unlinkError; const { error: deleteError } = await admin.from('financas').delete().eq('id', financialId).eq('vip_delivery_id', id); if (deleteError) { await admin.from('vip_deliveries').update({ financial_id: financialId }).eq('id', id); throw deleteError; } await admin.from('security_logs').insert({ action: 'vip_financial_deleted', user_email: email, performed_by: email, details: JSON.stringify({ delivery_id: id, financial_id: financialId }) }); return send(res, 200, { success: true }); }
    if (action === 'list-deliveries') { const { data, error } = await admin.from('vip_deliveries').select('*, vip_delivery_items(*), vip_memberships(active)').order('created_at', { ascending: false }); if (error) throw error; return send(res, 200, { deliveries: data }); }
    if (action === 'create-delivery') {
      if (!validServer(req.body?.server) || !/^\d{10,25}$/.test(String(req.body?.steamid || '')) || !req.body?.characterName || !req.body?.packageId || !req.body?.playerId) return send(res, 400, { error: 'Dados da entrega inválidos.' });
      const { data: player, error: playerError } = await admin.from('players').select('id,steamid,server').eq('id', req.body.playerId).eq('steamid', req.body.steamid).eq('server', req.body.server).maybeSingle();
      if (playerError) throw playerError; if (!player) return send(res, 400, { error: 'O jogador não pertence ao servidor selecionado.' });
      const { data: packageData, error: packageError } = await admin.from('vip_packages').select('active,vip_package_items(*)').eq('id', req.body.packageId).maybeSingle();
      if (packageError) throw packageError; if (!packageData?.active) return send(res, 400, { error: 'Pacote VIP indisponível.' });
      const items = validatedItems(packageData.vip_package_items);
      const operationKey = req.body?.operationKey || crypto.randomUUID();
      const { data: deliveryId, error } = await admin.rpc('create_vip_delivery', { p_operation_key: operationKey, p_package_id: req.body.packageId, p_player_id: player.id, p_steamid: player.steamid, p_character_name: req.body.characterName, p_server: player.server, p_payment_date: new Date().toISOString(), p_payment_method: null, p_admin_note: req.body.adminNote || null, p_created_by: email, p_items: items });
      if (error) throw error;
      const { data: delivery } = await admin.from('vip_deliveries').select('*').eq('id', deliveryId).single(); let online = false;
      try { online = playerIsOnline(await executeRcon(delivery.server, `findPlayer ${delivery.steamid}`), delivery.steamid); } catch { online = false; }
      if (!online) { await admin.from('vip_deliveries').update({ status: 'aguardando_online' }).eq('id', delivery.id); return send(res, 200, { deliveryId, status: 'aguardando_online' }); }
      const status = await processDelivery(admin, delivery); return send(res, 200, { deliveryId, status });
    }
    if (action === 'send-delivery') { const { data: delivery } = await admin.from('vip_deliveries').select('*').eq('id', req.body?.id).single(); const output = await executeRcon(delivery.server, `findPlayer ${delivery.steamid}`); if (!playerIsOnline(output, delivery.steamid)) return send(res, 409, { error: 'O jogador não está online no servidor selecionado.' }); const status = await processDelivery(admin, delivery); return send(res, 200, { status }); }
    return send(res, 400, { error: 'Ação VIP inválida.' });
  } catch (error) { return send(res, error.status || 500, { error: error.message || 'Falha no sistema VIP.' }); }
}
