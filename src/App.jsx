import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { AdminAuthProvider } from '@/lib/AdminAuthContext';
import { FinancialPasswordProvider } from '@/lib/FinancialPasswordContext';
import { SessionProvider } from '@/lib/SessionContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import LoginScreen from '@/components/LoginScreen';

import BlockedAccessScreen from '@/components/BlockedAccessScreen';
import PendingApprovalScreen from '@/components/PendingApprovalScreen';
import UnauthorizedAccessScreen from '@/components/UnauthorizedAccessScreen';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Players from '@/pages/Players';
import Financas from '@/pages/Financas';
import Compras from '@/pages/Compras';
import Banidos from '@/pages/Banidos';
import Despesas from '@/pages/Despesas';
import Relatorios from '@/pages/Relatorios';
import AdminAccess from '@/pages/AdminAccess';
import AdminSettings from '@/pages/AdminSettings';
import SecuritySettings from '@/pages/SecuritySettings';
import UserProfile from '@/pages/UserProfile';

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

  // Render the main app
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/players" element={<Players />} />
        <Route path="/financas" element={<Financas />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/banidos" element={<Banidos />} />
        <Route path="/despesas" element={<Despesas />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/admin-access" element={<AdminAccess />} />
        <Route path="/admin-settings" element={<AdminSettings />} />
        <Route path="/security-settings" element={<SecuritySettings />} />
        <Route path="/profile" element={<UserProfile />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <SessionProvider>
        <AdminAuthProvider>
          <FinancialPasswordProvider>
            <QueryClientProvider client={queryClientInstance}>
              <Router>
                <AuthenticatedApp />
              </Router>
              <Toaster />
            </QueryClientProvider>
          </FinancialPasswordProvider>
        </AdminAuthProvider>
      </SessionProvider>
    </AuthProvider>
  )
}

export default App