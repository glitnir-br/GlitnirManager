import { useAuth } from '@/lib/AuthContext';
import { ShieldOff } from 'lucide-react';

const ADMIN_ROLES = ['adm_principal', 'administrador'];

export default function AdminGuard({ children }) {
  const { user } = useAuth();

  if (!ADMIN_ROLES.includes(user?.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <ShieldOff className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Negado</h2>
        <p className="text-muted-foreground text-sm">Você não possui permissão para acessar esta área.</p>
      </div>
    );
  }

  return children;
}