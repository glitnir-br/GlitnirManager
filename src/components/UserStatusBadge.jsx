import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, Lock, Crown } from 'lucide-react';

const statusConfig = {
  pendente: {
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: Clock,
    label: 'Pendente',
  },
  ativo: {
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: CheckCircle2,
    label: 'Aprovado',
  },
  bloqueado: {
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: Lock,
    label: 'Bloqueado',
  },
};

const roleConfig = {
  adm_principal: {
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: Crown,
    label: 'ADM Principal',
  },
  administrador: {
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    label: 'Administrador',
  },
  financeiro: {
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    label: 'Financeiro',
  },
  moderador: {
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    label: 'Moderador',
  },
  usuario_comum: {
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    label: 'Usuário Comum',
  },
  pendente: {
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    label: 'Pendente',
  },
  bloqueado: {
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    label: 'Bloqueado',
  },
};

export function StatusBadge({ status }) {
  const config = statusConfig[status];
  if (!config) return null;

  const Icon = config.icon;
  return (
    <Badge className={`${config.color} border flex items-center gap-1 w-fit`}>
      {Icon && <Icon className="w-3 h-3" />}
      {config.label}
    </Badge>
  );
}

export function RoleBadge({ role }) {
  const config = roleConfig[role];
  if (!config) return null;

  const Icon = config.icon;
  return (
    <Badge className={`${config.color} border flex items-center gap-1 w-fit`}>
      {Icon && <Icon className="w-3 h-3" />}
      {config.label}
    </Badge>
  );
}
