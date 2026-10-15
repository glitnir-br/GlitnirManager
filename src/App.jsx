import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { AdminAuthProvider } from '@/lib/AdminAuthContext';
import { FinancialPasswordProvider } from '@/lib/FinancialPasswordContext';
import { ServerProvider } from '@/lib/ServerContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import LoginScreen from '@/components/LoginScreen';
import ForcedPasswordChange from '@/components/ForcedPasswordChange';

import BlockedAccessScreen from '@/components/BlockedAccessScreen';
import PendingApprovalScreen from '@/components/PendingApprovalScreen';
import UnauthorizedAccessScreen from '@/components/UnauthorizedAccessScreen';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Servidores from '@/pages/Servidores';
import Jogadores from '@/pages/Jogadores';
import Financeiro from '@/pages/Financeiro';
import Mods from '@/pages/Mods';
import Administracao from '@/pages/Administracao';
import UserProfile from '@/pages/UserProfile';
import DeleteConfirmationProvider from '@/components/DeleteConfirmationProvider';
import PagePermissionGuard from '@/components/PagePermissionGuard';
import { PermissionsProvider } from '@/lib/PermissionsContext';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, user } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Se não está autenticado, mostrar tela de login
  if (!user) {
    if (authError?.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    
    return <LoginScreen />;
  }

  // Se usuário está bloqueado
  if (user.status === 'bloqueado' || user.role === 'bloqueado') {
    return <BlockedAccessScreen />;
  }

  // Se usuário está pendente de aprovação
  if (user.status === 'pendente' || user.role === 'pendente') {
    return <PendingApprovalScreen />;
  }

  // Se usuário não autorizado (e-mail sem perfil aprovado)
  if (user.status === 'nao_autorizado' || user.role === 'nao_autorizado') {
    return <UnauthorizedAccessScreen />;
  }

  if (user.must_change_password) {
    return <ForcedPasswordChange />;
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<PagePermissionGuard page="dashboard"><Dashboard /></PagePermissionGuard>} />
        <Route path="/servidores" element={<PagePermissionGuard page="servidores"><Servidores /></PagePermissionGuard>} />
        <Route path="/jogadores" element={<PagePermissionGuard page="jogadores"><Jogadores /></PagePermissionGuard>} />
        <Route path="/players" element={<Navigate to="/jogadores" replace />} />
        <Route path="/financeiro" element={<PagePermissionGuard page="financeiro"><Financeiro /></PagePermissionGuard>} />
        <Route path="/financas" element={<Navigate to="/financeiro" replace />} />
        <Route path="/banidos" element={<Navigate to="/jogadores?tab=banidos" replace />} />
        <Route path="/atelier" element={<Navigate to="/mods?tab=atelier" replace />} />
        <Route path="/mods" element={<PagePermissionGuard page="mods"><Mods /></PagePermissionGuard>} />
        <Route path="/despesas" element={<Navigate to="/financeiro?tab=despesas" replace />} />
        <Route path="/administracao" element={<PagePermissionGuard page="administracao"><Administracao /></PagePermissionGuard>} />
        <Route path="/admin-access" element={<Navigate to="/administracao" replace />} />
        <Route path="/admin-settings" element={<Navigate to="/administracao?tab=configuracoes" replace />} />
        <Route path="/security-settings" element={<Navigate to="/administracao?tab=seguranca" replace />} />
        <Route path="/profile" element={<UserProfile />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <div className="notranslate" translate="no">
    <DeleteConfirmationProvider>
    <AuthProvider>
        <ServerProvider>
        <AdminAuthProvider>
          <FinancialPasswordProvider>
            <QueryClientProvider client={queryClientInstance}>
              <PermissionsProvider><Router>
                <AuthenticatedApp />
              </Router></PermissionsProvider>
              <Toaster />
            </QueryClientProvider>
          </FinancialPasswordProvider>
        </AdminAuthProvider>
        </ServerProvider>
    </AuthProvider>
    </DeleteConfirmationProvider>
    </div>
  )
}

export default App
