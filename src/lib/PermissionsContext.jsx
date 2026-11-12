import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44, isSupabaseConfigured } from '@/api/dbClient';
import { useAuth } from '@/lib/AuthContext';
import { resolveAllowedPages } from '@/lib/permissionRules';

const PermissionsContext = createContext();

export const PAGE_PERMISSIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'servidores', label: 'Servidores' },
  { key: 'rcon', label: 'Rcon' },
  { key: 'rcon_testes', label: 'Rcon de Testes' },
  { key: 'jogadores', label: 'Jogadores' },
  { key: 'player_item_deliveries', label: 'Jogadores · Enviar itens e consultar histórico' },
  { key: 'territorios', label: 'Territórios' },
  { key: 'personagem', label: 'Personagem' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'administracao', label: 'Administração' },
];

const LEGACY_PERMISSIONS = {
  adm_principal: PAGE_PERMISSIONS.map(({ key }) => key),
  administrador: PAGE_PERMISSIONS.map(({ key }) => key),
  financeiro: ['dashboard', 'jogadores', 'financeiro'],
  visitante: ['dashboard', 'jogadores', 'mods'],
};

export function PermissionsProvider({ children }) {
  const { user } = useAuth();
  const { data: permissions = [], isLoading, isError } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: () => base44.entities.RolePermission.list(),
    enabled: Boolean(user && isSupabaseConfigured()),
    staleTime: 30_000,
  });
  const allowedPages = useMemo(() => {
    return resolveAllowedPages(user?.role, permissions, LEGACY_PERMISSIONS, isLoading || isError);
  }, [permissions, user?.role, isLoading, isError]);
  const hasPage = (page) => allowedPages.includes(page);
  return <PermissionsContext.Provider value={{ hasPage, allowedPages, isLoadingPermissions: isLoading }}>{children}</PermissionsContext.Provider>;
}

export const usePermissions = () => useContext(PermissionsContext) || { hasPage: () => false, allowedPages: [] };
