import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    // Valida o token secreto compartilhado com o bot do Discord
    const token = req.headers.get('x-whitelist-token') || '';
    const expectedToken = secrets.get('WHITELIST_TOKEN');
    if (!expectedToken || token !== expectedToken) {
      return Response.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Lê o corpo da requisição (nick + steamid)
    const body = await req.json();
    const nick = (body.nick || '').toString().trim();
    const steamid = (body.steamid || '').toString().trim();

    if (!nick || !steamid) {
      return Response.json({ error: 'nick e steamid são obrigatórios' }, { status: 400 });
    }

    // Cria o player usando service role (sem login de usuário)
    const base44 = createClientFromRequest(req);
    const player = await base44.asServiceRole.entities.Player.create({
      nick,
      steamid,
      status: 'ativo'
    });

    return Response.json({ ok: true, player });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}