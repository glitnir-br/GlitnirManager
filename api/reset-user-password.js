import { createClient } from '@supabase/supabase-js';

const send = (res, status, body) => res.status(status).json(body);
const randomPassword = () => `${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}Aa!`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!url || !key || !token) return send(res, 401, { error: 'Configuração ou autenticação ausente.' });
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: auth } = await admin.auth.getUser(token);
    const actor = auth.user?.email;
    const { data: actorProfile } = await admin.from('user_profiles').select('role,status').eq('email', actor).maybeSingle();
    const targetEmail = String(req.body?.email || '').trim().toLowerCase();
    if (!actor || actorProfile?.role !== 'adm_principal' || !['ativo', 'aprovado'].includes(actorProfile.status)) return send(res, 403, { error: 'Apenas o ADM Principal pode resetar senhas.' });
    if (!targetEmail || targetEmail === actor.toLowerCase()) return send(res, 400, { error: 'Use a alteração de senha no seu perfil para a própria conta.' });
    const { data: targetProfile } = await admin.from('user_profiles').select('id').eq('email', targetEmail).maybeSingle();
    if (!targetProfile) return send(res, 404, { error: 'Usuário não encontrado.' });
    const { data: users, error: usersError } = await admin.auth.admin.listUsers();
    if (usersError) throw usersError;
    const target = users.users.find((item) => item.email?.toLowerCase() === targetEmail);
    if (!target) return send(res, 404, { error: 'Conta de autenticação não encontrada para este usuário.' });
    const temporaryPassword = randomPassword();
    const { error } = await admin.auth.admin.updateUserById(target.id, { password: temporaryPassword });
    if (error) throw error;
    await admin.from('user_profiles').update({ must_change_password: true }).eq('id', targetProfile.id);
    await admin.from('security_logs').insert({ action: 'password_reset_by_admin', user_email: targetEmail, performed_by: actor, details: 'Senha temporária gerada pelo ADM Principal.', timestamp: new Date().toISOString() });
    return send(res, 200, { email: targetEmail, temporaryPassword });
  } catch (error) { return send(res, 500, { error: error.message || 'Falha ao resetar senha.' }); }
}
