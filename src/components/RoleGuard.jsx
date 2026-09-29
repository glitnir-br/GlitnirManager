import { useAuth } from '@/lib/AuthContext';
import AccessDenied from '@/components/AccessDenied';

/**
 * Protege uma área com base em roles permitidos.
 * Uso: <RoleGuard allowed={['adm_principal', 'administrador']}>...</RoleGuard>
 */
export default function RoleGuard({ allowed, children }) {
  const { user } = useAuth();

  if (!allowed.includes(user?.role)) {
    return <AccessDenied />;
  }

  return children;
}
