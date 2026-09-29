import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/dbClient';

const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
  const [adminPassword, setAdminPassword] = useState(null);
  const [isPasswordUnlocked, setIsPasswordUnlocked] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    loadAdminPassword();
  }, []);

  const loadAdminPassword = async () => {
    try {
      // Senha padrão para áreas financeiras
      const defaultPassword = 'Pituca00';
      const settings = await base44.entities.AdminSettings.filter({ setting_key: 'admin_password' });
      if (settings.length > 0) {
        setAdminPassword(settings[0].admin_password);
      } else {
        // Se não houver configuração, usar senha padrão
        setAdminPassword(defaultPassword);
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
      // Fallback para senha padrão em caso de erro
      setAdminPassword('Pituca00');
    } finally {
      setLoadingSettings(false);
    }
  };

  const verifyPassword = (password) => {
    // Comparação simples (em produção usar hash)
    return password === adminPassword;
  };

  const setNewPassword = async (newPassword, updatedBy) => {
    try {
      const existing = await base44.entities.AdminSettings.filter({ setting_key: 'admin_password' });
      if (existing.length > 0) {
        await base44.entities.AdminSettings.update(existing[0].id, {
          admin_password: newPassword,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        });
      } else {
        await base44.entities.AdminSettings.create({
          setting_key: 'admin_password',
          admin_password: newPassword,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        });
      }
      setAdminPassword(newPassword);
      return true;
    } catch (err) {
      console.error('Erro ao atualizar senha:', err);
      return false;
    }
  };

  const logSecurityAction = async (action, userEmail, performedBy, details = '') => {
    try {
      await base44.entities.SecurityLog.create({
        action,
        user_email: userEmail,
        performed_by: performedBy,
        details,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Erro ao registrar log:', err);
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        isPasswordUnlocked,
        setIsPasswordUnlocked,
        verifyPassword,
        setNewPassword,
        logSecurityAction,
        loadingSettings,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
