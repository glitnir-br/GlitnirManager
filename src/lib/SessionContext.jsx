import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

const SessionContext = createContext();

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos

export const SessionProvider = ({ children }) => {
  const { user, logout } = useAuth();
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const resetTimeout = useCallback(() => {
    if (!user) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    lastActivityRef.current = Date.now();
    
    timeoutRef.current = setTimeout(() => {
      base44.analytics.track({
        eventName: 'session_timeout',
        properties: { user_email: user.email }
      });
      logout();
    }, SESSION_TIMEOUT);
  }, [user, logout]);

  useEffect(() => {
    if (!user) return;

    const handleActivity = () => resetTimeout();

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    resetTimeout();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, resetTimeout]);

  return (
    <SessionContext.Provider value={{ lastActivity: lastActivityRef.current }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession deve ser usado dentro de SessionProvider');
  }
  return context;
};