import { base44 } from '@/api/base44Client';

export const logSecurityEvent = async (action, user_email, details = {}, performed_by = null) => {
  try {
    await base44.entities.SecurityLog.create({
      action,
      user_email,
      performed_by: performed_by || user_email,
      details: JSON.stringify(details),
      ip_address: 'browser', // IP pode ser obtido do backend
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Erro ao registrar evento de segurança:', err);
  }
};

export const getAuditTrail = async (user_email = null, limit = 100) => {
  try {
    const query = user_email ? { user_email } : {};
    const logs = await base44.entities.SecurityLog.filter(query, '-created_date', limit);
    return logs;
  } catch (err) {
    console.error('Erro ao buscar auditoria:', err);
    return [];
  }
};