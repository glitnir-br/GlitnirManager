import { createClient } from '@supabase/supabase-js';
import vanillaCatalog from '../src/data/valheim-item-catalog.json' with { type: 'json' };
import modpackCatalog from '../src/data/glitnir-prefab-catalog.json' with { type: 'json' };
import { itemDisplayName } from '../src/lib/itemNames.js';
import { executeRcon } from './rcon.js';

const catalog = new Map([...Object.values(vanillaCatalog), ...Object.values(modpackCatalog)].filter((item) => item?.prefab).map((item) => [item.prefab, item]));
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
    if (action === 'send') {
      const playerId = req.body?.playerId; const server = req.body?.server; const steamid = String(req.body?.steamid || ''); const prefab = String(req.body?.prefab || ''); const quantity = Number(req.body?.quantity); const qualityValue = String(req.body?.quality ?? '').trim(); const quality = qualityValue === '' ? null : Number(qualityValue); const operationKey = req.body?.operationKey || crypto.randomUUID();
      if (!playerId || !validServer(server) || !/^\d{10,25}$/.test(steamid)) return send(res, 400, { error: 'Jogador ou servidor inválido.' });
      const known = catalog.get(prefab); if (!known) return send(res, 400, { error: 'Prefab inválido.' });
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000 || (quality !== null && (!Number.isInteger(quality) || quality < 1 || (known.maxQuality && quality > known.maxQuality)))) return send(res, 400, { error: 'Quantidade ou qualidade inválida.' });
      const { data: existing } = await admin.from('player_item_deliveries').select('*').eq('operation_key', operationKey).maybeSingle(); if (existing) return existing.status === 'entregue' ? send(res, 200, { delivery: existing }) : send(res, 409, { error: 'Esta tentativa de envio não foi concluída.', delivery: existing });
      const { data: player, error: playerError } = await admin.from('players').select('id,steamid,server,nick,personagens').eq('id', playerId).eq('steamid', steamid).eq('server', server).maybeSingle(); if (playerError) throw playerError; if (!player) return send(res, 400, { error: 'O jogador não pertence ao servidor selecionado.' });
      const characterName = player.personagens?.filter(Boolean)?.[0] || player.nick || steamid; const mailCommand = `mpmail send ${steamid} ${prefab} ${quantity}${quality === null ? '' : ` ${quality}`}`; const command = `consoleCommand ${mailCommand}`;
      const { data: delivery, error: insertError } = await admin.from('player_item_deliveries').insert({ operation_key: operationKey, player_id: player.id, steamid, character_name: characterName, server, friendly_name: itemDisplayName(known), prefab, quantity, quality, status: 'em_processamento', command, created_by: email }).select().single(); if (insertError) throw insertError;
      try { const response = await executeRcon(server, command); const failed = /(error|failed|failure|not found|offline|invalid|exception|erro|falhou|não encontrado|nao encontrado)/i.test(response); const uncertain = response === 'Comando executado sem resposta.'; const status = uncertain ? 'resultado_incerto' : failed ? 'falhou' : 'entregue'; const { data: completed } = await admin.from('player_item_deliveries').update({ status, response, completed_at: new Date().toISOString() }).eq('id', delivery.id).select().single(); if (status !== 'entregue') return send(res, uncertain ? 502 : 422, { error: uncertain ? 'Envio não concluído: o servidor não confirmou a execução do comando.' : 'Envio não concluído: o servidor retornou um erro.', delivery: completed }); return send(res, 200, { delivery: completed }); } catch (error) { const { data: completed } = await admin.from('player_item_deliveries').update({ status: 'falhou', error: error.message, completed_at: new Date().toISOString() }).eq('id', delivery.id).select().single(); return send(res, error.status && error.status >= 400 ? error.status : 502, { error: `Envio não concluído: ${error.message}`, delivery: completed }); }
    }
    return send(res, 400, { error: 'Ação inválida.' });
  } catch (error) { return send(res, error.status || 500, { error: error.message || 'Falha ao gerenciar envio de itens.' }); }
}
