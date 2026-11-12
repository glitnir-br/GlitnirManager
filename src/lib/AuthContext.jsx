import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44, isSupabaseConfigured } from '@/api/dbClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      if (isSupabaseConfigured()) {
        const authenticatedUser = await base44.auth.me();
        setUser(authenticatedUser);
        setIsAuthenticated(Boolean(authenticatedUser));
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }
      
      localStorage.removeItem('glitnir_local_user');
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
    } catch (error) {
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const loginWithPassword = async (usernameOrEmail, password) => {
    if (isSupabaseConfigured()) {
      try {
        const email = usernameOrEmail.trim().toLowerCase();
        if (!email.includes('@')) return { success: false, message: 'Use o e-mail cadastrado no Supabase.' };
        const authUser = await base44.auth.signInWithPassword(email, password);
        const profiles = await base44.entities.UserProfile.filter({ email: authUser.email });
        setUser({ ...authUser, ...(profiles[0] || { role: 'visitante', status: 'pendente' }) });
        setIsAuthenticated(true);
        return { success: true };
      } catch (error) {
        return { success: false, message: error.message || 'Falha no login Supabase.' };
      }
    }
    return { success: false, message: 'Supabase não configurado. Não é possível entrar.' };
  };

  const logout = (shouldRedirect = false) => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('glitnir_local_user');
    
    try {
      if (base44?.auth?.logout) {
        base44.auth.logout();
      }
    } catch (e) {
      console.warn('Base44 logout cleanup ignored:', e);
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      loginWithPassword,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
