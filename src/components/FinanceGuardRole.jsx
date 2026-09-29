import { useAuth } from '@/lib/AuthContext';
import AccessDenied from '@/components/AccessDenied';

const FINANCE_ROLES = ['adm_principal', 'administrador', 'financeiro'];

export default function FinanceGuardRole({ children }) {
  const { user } = useAuth();

  if (!FINANCE_ROLES.includes(user?.role)) {
    return <AccessDenied />;
  }

  return children;
}
