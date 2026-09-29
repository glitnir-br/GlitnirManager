import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const FinancialPasswordContext = createContext();

const STORAGE_KEY = 'glitnir_unlocked_modules';

const loadFromSession = () => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveToSession = (modules) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
  } catch {}
};

export const FinancialPasswordProvider = ({ children }) => {
  const [unlockedModules, setUnlockedModules] = useState(() => loadFromSession());

  const isModuleUnlocked = useCallback((module) => {
    return !!unlockedModules[module];
  }, [unlockedModules]);

  const unlockModule = useCallback((module) => {
    setUnlockedModules(prev => {
      const next = { ...prev, [module]: true };
      saveToSession(next);
      return next;
    });
  }, []);

  const lockModule = useCallback((module) => {
    setUnlockedModules(prev => {
      const next = { ...prev };
      delete next[module];
      saveToSession(next);
      return next;
    });
  }, []);

  // Limpa todos os módulos desbloqueados (usar quando senha for trocada)
  const lockAllModules = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setUnlockedModules({});
  }, []);

  return (
    <FinancialPasswordContext.Provider value={{
      isModuleUnlocked,
      unlockModule,
      lockModule,
      lockAllModules,
      unlockedModules
    }}>
      {children}
    </FinancialPasswordContext.Provider>
  );
};

export const useFinancialPassword = () => {
  const context = useContext(FinancialPasswordContext);
  if (!context) {
    throw new Error('useFinancialPassword must be used within FinancialPasswordProvider');
  }
  return context;
};