import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44, isSupabaseConfigured } from '@/api/dbClient';
import { useAuth } from '@/lib/AuthContext';

const PermissionsContext = createContext();

export const PAGE_PERMISSIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'servidores', label: 'Servidores' },
  { key: 'rcon', label: 'Rcon' },
  { key: 'jogadores', label: 'Jogadores' },
  { key: 'player_item_deliveries', label: 'Jogadores · Enviar itens e consultar histórico' },
  { key: 'vip', label: 'VIP' },
  { key: 'territorios', label: 'Territórios' },
  { key: 'personagem', label: 'Personagem' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'administracao', label: 'Administração' },
  { key: 'vip_manage_packages', label: 'VIP · Gerenciar pacotes' },
  { key: 'vip_deliveries', label: 'VIP · Criar e executar entregas' },
  { key: 'vip_history', label: 'VIP · Consultar histórico' },
  { key: 'vip_finance', label: 'VIP · Visualizar dados financeiros' },
];

const LEGACY_PERMISSIONS = {
  adm_principal: PAGE_PERMISSIONS.map(({ key }) => key),
  administrador: PAGE_PERMISSIONS.map(({ key }) => key),
  financeiro: ['dashboard', 'jogadores', 'financeiro'],
  visitante: ['dashboard', 'jogadores', 'mods'],
};

export function PermissionsProvider({ children }) {
  const { user } = useAuth();
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: () => base44.entities.RolePermission.list(),
    enabled: Boolean(user && isSupabaseConfigured()),
    staleTime: 30_000,
  });
  const allowedPages = useMemo(() => {
    if (user?.role === 'adm_principal') return LEGACY_PERMISSIONS.adm_principal;
    const saved = permissions.filter((item) => item.role_key === user?.role && item.allowed).map((item) => item.page_key);
    return saved.length ? saved : (LEGACY_PERMISSIONS[user?.role] || []);
  }, [permissions, user?.role]);
  const hasPage = (page) => allowedPages.includes(page);
  return <PermissionsContext.Provider value={{ hasPage, allowedPages, isLoadingPermissions: isLoading }}>{children}</PermissionsContext.Provider>;
}

export const usePermissions = () => useContext(PermissionsContext) || { hasPage: () => false, allowedPages: [] };
