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
      
      const storedLocalUser = localStorage.getItem('glitnir_local_user');
      if (storedLocalUser) {
        try {
          const parsedUser = JSON.parse(storedLocalUser);
          setUser(parsedUser);
          setIsAuthenticated(true);
          setIsLoadingAuth(false);
          setIsLoadingPublicSettings(false);
          setAuthChecked(true);
          return;
        } catch (e) {
          localStorage.removeItem('glitnir_local_user');
        }
      }
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
    // Definindo credenciais padrão locais
    const defaultUsers = [
      {
        username: 'admin',
        email: 'admin@glitnir.com',
        passwords: ['admin123', 'admin', 'Pituca00'],
        userData: {
          id: 'user_local_admin',
          email: 'admin@glitnir.com',
          full_name: 'Administrador Glitnir',
          role: 'adm_principal',
          status: 'ativo'
        }
      },
      {
        username: 'empreendedor.padilha1998@gmail.com',
        email: 'empreendedor.padilha1998@gmail.com',
        passwords: ['admin123', 'admin', 'Pituca00'],
        userData: {
          id: 'user_local_padilha',
          email: 'empreendedor.padilha1998@gmail.com',
          full_name: 'Victor Padilha (ADM)',
          role: 'adm_principal',
          status: 'ativo'
        }
      }
    ];

    const inputClean = usernameOrEmail.trim().toLowerCase();
    
    // Verifica se é o usuário padrão ou aceita login com qualquer credencial Válida
    const matchedUser = defaultUsers.find(
      u => u.username.toLowerCase() === inputClean || u.email.toLowerCase() === inputClean
    );

    if (matchedUser) {
      if (matchedUser.passwords.includes(password)) {
        setUser(matchedUser.userData);
        setIsAuthenticated(true);
        localStorage.setItem('glitnir_local_user', JSON.stringify(matchedUser.userData));
        return { success: true };
      } else {
        return { success: false, message: 'Senha incorreta.' };
      }
    }

    // Se o usuário digitou admin / admin123 ou aceitar qualquer senha de admin para facilidade local
    if ((inputClean === 'admin' || inputClean === 'admin@glitnir.com') && (password === 'admin123' || password === 'admin' || password === 'Pituca00')) {
      const userData = {
        id: 'user_local_admin',
        email: 'admin@glitnir.com',
        full_name: 'Administrador Glitnir',
        role: 'adm_principal',
        status: 'ativo'
      };
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('glitnir_local_user', JSON.stringify(userData));
      return { success: true };
    }

    // Fallback: permitir login de teste com qualquer email/usuário e senha se senha tiver pelo menos 4 caracteres
    if (password && password.length >= 4) {
      const userData = {
        id: `user_${Date.now()}`,
        email: inputClean.includes('@') ? inputClean : `${inputClean}@glitnir.com`,
        full_name: usernameOrEmail,
        role: 'adm_principal',
        status: 'ativo'
      };
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('glitnir_local_user', JSON.stringify(userData));
      return { success: true };
    }

    return { success: false, message: 'Usuário ou senha inválidos.' };
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
