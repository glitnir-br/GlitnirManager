import { createClient } from '@supabase/supabase-js';
import itemCatalog from '../src/data/awakening-item-catalog.json' with { type: 'json' };
import { itemDisplayName } from '../src/lib/itemNames.js';
import { executeRcon } from './rcon.js';
import { executeDelivery } from '../src/lib/delivery-result.js';

const catalog = new Map(Object.values(itemCatalog).filter((item) => item.sendable).map((item) => [item.prefab, item]));
const send = (res, status, body) => res.status(status).json(body);
const validServer = (value) => value === 'server_1' || value === 'server_2';

async function auth(req) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw Object.assign(new Error('Configuração do Supabase incompleta.'), { status: 500 });
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, ''); if (!token) throw Object.assign(new Error('Autenticação necessária.'), { status: 401 });
  const admin = createClient(url, key, { auth: { persistSession: false } }); const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email) throw Object.assign(new Error('Sessão inválida.'), { status: 401 });
  const { data: profile } = await admin.from('user_profiles').select('role,status').eq('email', data.user.email).maybeSingle();
  if (!profile || !['ativo', 'aprovado'].includes(profile.status)) throw Object.assign(new Error('Usuário sem acesso ativo.'), { status: 403 });
  const { data: permissions } = await admin.from('role_permissions').select('page_key,allowed').eq('role_key', profile.role);
  const allowed = profile.role === 'adm_principal' || (permissions?.length ? permissions.some((item) => item.page_key === 'player_item_deliveries' && item.allowed) : profile.role === 'administrador');
  if (!allowed) throw Object.assign(new Error('Seu cargo não possui permissão para enviar itens.'), { status: 403 });
  return { admin, email: data.user.email };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  try {
    const { admin, email } = await auth(req); const action = req.body?.action || 'list';
    if (action === 'list') { const server = req.body?.server; if (!validServer(server)) return send(res, 400, { error: 'Servidor inválido.' }); const { data, error } = await admin.from('player_item_deliveries').select('*').eq('server', server).order('created_at', { ascending: false }); if (error) throw error; return send(res, 200, { deliveries: data }); }
    if (action === 'resolve') {
      const server = req.body?.server; const deliveryId = req.body?.deliveryId; const resolution = req.body?.resolution;
      if (!validServer(server) || !deliveryId || !['verificada_entregue', 'verificada_nao_entregue'].includes(resolution)) return send(res, 400, { error: 'Conferência inválida.' });
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data, error } = await admin.from('player_item_deliveries').update({ status: resolution, completed_at: new Date().toISOString() }).eq('id', deliveryId).eq('server', server).or(`status.eq.resultado_incerto,and(status.eq.em_processamento,created_at.lt.${cutoff})`).select().maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 409, { error: 'Envio não encontrado ou já conferido.' });
      await admin.from('security_logs').insert({ action: 'item_delivery_resolved', user_email: email, performed_by: email, details: JSON.stringify({ deliveryId, server, resolution }), timestamp: new Date().toISOString() });
      return send(res, 200, { delivery: data });
    }
    if (action === 'send') {
      const playerId = req.body?.playerId; const server = req.body?.server; const steamid = String(req.body?.steamid || ''); const prefab = String(req.body?.prefab || ''); const quantity = Number(req.body?.quantity); const qualityValue = String(req.body?.quality ?? '').trim(); const quality = qualityValue === '' ? null : Number(qualityValue); const operationKey = req.body?.operationKey || crypto.randomUUID();
      if (!playerId || !validServer(server) || !/^\d{10,25}$/.test(steamid)) return send(res, 400, { error: 'Jogador ou servidor inválido.' });
      const known = catalog.get(prefab); if (!known) return send(res, 400, { error: 'Prefab inválido.' });
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000 || (quality !== null && (!Number.isInteger(quality) || quality < 1 || (known.maxQuality && quality > known.maxQuality)))) return send(res, 400, { error: 'Quantidade ou qualidade inválida.' });
      const { data: existing } = await admin.from('player_item_deliveries').select('*').eq('operation_key', operationKey).maybeSingle(); if (existing) return ['entregue', 'verificada_entregue'].includes(existing.status) ? send(res, 200, { delivery: existing }) : send(res, 409, { error: 'Esta tentativa já foi registrada. Confira o histórico antes de tentar novamente.', delivery: existing });
      const { data: player, error: playerError } = await admin.from('players').select('id,steamid,server,nick,personagens').eq('id', playerId).eq('steamid', steamid).eq('server', server).maybeSingle(); if (playerError) throw playerError; if (!player) return send(res, 400, { error: 'O jogador não pertence ao servidor selecionado.' });
      const characterName = player.personagens?.filter(Boolean)?.[0] || player.nick || steamid; const mailCommand = `mpmail send ${steamid} ${prefab} ${quantity}${quality === null ? '' : ` ${quality}`}`; const command = `consoleCommand ${mailCommand}`;
      const { data: delivery, error: insertError } = await admin.from('player_item_deliveries').insert({ operation_key: operationKey, player_id: player.id, steamid, character_name: characterName, server, friendly_name: itemDisplayName(known), prefab, quantity, quality, status: 'em_processamento', command, created_by: email }).select().single();
      if (insertError?.code === '23505') return send(res, 409, { error: 'Já existe envio pendente ou não conferido para este item e jogador. Confira o histórico antes de tentar novamente.' });
      if (insertError) throw insertError;
      const result = await executeDelivery({ execute: executeRcon, server, command, persist: async (changes) => {
        const { data, error } = await admin.from('player_item_deliveries').update({ ...changes, completed_at: new Date().toISOString() }).eq('id', delivery.id).select().single();
        if (error) throw error;
        return data;
      } });
      if (result.status !== 'entregue') return send(res, result.status === 'resultado_incerto' ? 502 : 422, { error: result.status === 'resultado_incerto' ? 'Resultado incerto. Confira o histórico e o jogo antes de tentar novamente.' : 'Envio não concluído: o servidor retornou um erro.', delivery: result.delivery });
      return send(res, 200, { delivery: result.delivery });
    }
    return send(res, 400, { error: 'Ação inválida.' });
  } catch (error) { return send(res, error.status || 500, { error: error.message || 'Falha ao gerenciar envio de itens.' }); }
}
