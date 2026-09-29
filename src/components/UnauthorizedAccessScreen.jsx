import React from 'react';
import { ShieldX } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function UnauthorizedAccessScreen() {
  const { logout } = useAuth();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="w-full max-w-md px-4">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center">
              <ShieldX className="w-8 h-8 text-destructive" />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-foreground">Acesso Não Autorizado</h1>
            <p className="text-muted-foreground">
              Este e-mail não tem permissão para acessar o sistema. Contas novas não são criadas automaticamente.
            </p>
          </div>

          <div className="bg-secondary/50 border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground text-center">
              Solicite o acesso ao administrador para que seu e-mail seja liberado.
            </p>
          </div>

          <button
            onClick={() => logout(true)}
            className="w-full h-11 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
