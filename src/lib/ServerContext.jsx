import React, { createContext, useContext, useEffect, useState } from 'react';

export const SERVERS = [
  { value: 'server_1', label: 'Server 1' },
  { value: 'server_2', label: 'Server 2' },
];

const ServerContext = createContext(null);

export function ServerProvider({ children }) {
  const [server, setServer] = useState(() => localStorage.getItem('glitnir_active_server') || 'server_1');

  useEffect(() => {
    localStorage.setItem('glitnir_active_server', server);
  }, [server]);

  const serverLabel = SERVERS.find((item) => item.value === server)?.label || 'Server 1';
  return <ServerContext.Provider value={{ server, serverLabel, setServer }}>{children}</ServerContext.Provider>;
}

export function useServer() {
  const context = useContext(ServerContext);
  if (!context) throw new Error('useServer deve ser usado dentro de ServerProvider.');
  return context;
}
