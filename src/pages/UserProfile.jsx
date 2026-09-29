import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Shield, Calendar, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ROLE_LABELS = {
  adm_principal: { label: 'ADM Principal', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  administrador: { label: 'Admin',         color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  financeiro:    { label: 'Financeiro',    color: 'bg-green-500/20 text-green-400 border-green-500/40' },
  moderador:     { label: 'Moderador',     color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  suporte:       { label: 'Suporte',       color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' },
  visitante:     { label: 'Visitante',     color: 'bg-muted text-muted-foreground border-border' },
  pendente:      { label: 'Pendente',      color: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
  bloqueado:     { label: 'Bloqueado',     color: 'bg-red-500/20 text-red-400 border-red-500/40' },
};

export default function UserProfile() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const roleInfo = ROLE_LABELS[user?.role] || ROLE_LABELS.usuario_comum;

  const handleLogout = () => {
    setLoggingOut(true);
    logout();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">Informações da sua conta</p>
      </div>

      {/* Avatar + info */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center text-2xl font-bold text-primary">
            {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{user?.full_name || 'Usuário'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{user?.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detalhes */}
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Cargo</span>
          </div>
          <Badge variant="outline" className={roleInfo.color}>{roleInfo.label}</Badge>
        </div>

        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Status</span>
          </div>
          <Badge variant="outline" className={
            user?.status === 'ativo' ? 'bg-green-500/20 text-green-400 border-green-500/40' :
            user?.status === 'bloqueado' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
            'bg-muted text-muted-foreground'
          }>
            {user?.status === 'ativo' ? 'Ativo' : user?.status === 'bloqueado' ? 'Bloqueado' : user?.status || 'Pendente'}
          </Badge>
        </div>

        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Membro desde</span>
          </div>
          <span className="text-sm text-foreground">
            {user?.created_date ? format(new Date(user.created_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '—'}
          </span>
        </div>
      </div>

      {/* Logout */}
      <Button
        variant="destructive"
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full"
      >
        <LogOut className="w-4 h-4 mr-2" />
        {loggingOut ? 'Saindo...' : 'Sair da Conta'}
      </Button>
    </div>
  );
}
