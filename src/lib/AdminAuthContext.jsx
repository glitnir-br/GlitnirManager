import React, { createContext, useContext } from 'react';
import { base44 } from '@/api/dbClient';

const AdminAuthContext = createContext();

export function AdminAuthProvider({ children }) {
  const logSecurityAction = async (action, userEmail, performedBy, details = '') => {
    try {
      await base44.entities.SecurityLog.create({ action, user_email: userEmail, performed_by: performedBy, details, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Erro ao registrar log:', error);
    }
  };
  return <AdminAuthContext.Provider value={{ logSecurityAction }}>{children}</AdminAuthContext.Provider>;
}

export const useAdminAuth = () => useContext(AdminAuthContext);
