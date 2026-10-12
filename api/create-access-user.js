import { createClient } from '@supabase/supabase-js';

const ROLES = new Set(['administrador', 'financeiro', 'visitante']);
const randomPassword = () => `${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}Aa!`;
const send = (res, status, body) => res.status(status).json(body);

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!url || !key || !token) return send(res, 401, { error: 'Configuração ou autenticação ausente.' });
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: auth } = await admin.auth.getUser(token);
    const email = auth.user?.email;
    const { data: profile } = await admin.from('user_profiles').select('role,status').eq('email', email).maybeSingle();
    if (!email || !profile || !['adm_principal', 'administrador'].includes(profile.role) || !['ativo', 'aprovado'].includes(profile.status)) return send(res, 403, { error: 'Sem permissão para criar acessos.' });
    const newEmail = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || 'visitante');
    if (!/^\S+@\S+\.\S+$/.test(newEmail) || !ROLES.has(role)) return send(res, 400, { error: 'E-mail ou cargo inválido.' });
    const { data: existing } = await admin.from('user_profiles').select('id').eq('email', newEmail).maybeSingle();
    if (existing) return send(res, 409, { error: 'Este e-mail já possui acesso.' });
    const temporaryPassword = randomPassword();
    const { error: createError } = await admin.auth.admin.createUser({ email: newEmail, password: temporaryPassword, email_confirm: true });
    if (createError) throw createError;
    const now = new Date().toISOString();
    const { error: profileError } = await admin.from('user_profiles').insert({ email: newEmail, role, status: 'ativo', approved_by: email, approved_date: now, must_change_password: true });
    if (profileError) throw profileError;
    await admin.from('access_requests').insert({ email: newEmail, status: 'aprovado', role });
    await admin.from('security_logs').insert({ action: 'access_invite', user_email: newEmail, performed_by: email, details: `Acesso criado com senha temporária. Cargo: ${role}.`, timestamp: now });
    return send(res, 200, { email: newEmail, temporaryPassword });
  } catch (error) { return send(res, 500, { error: error.message || 'Falha ao criar acesso.' }); }
}
