import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';

const ACTION_LABELS = {
  user_approved: 'Usuário Aprovado',
  user_rejected: 'Usuário Rejeitado',
  user_blocked: 'Usuário Bloqueado',
  role_changed: 'Role Alterada',
  access_removed: 'Acesso Removido',
  financial_access: 'Acesso Financeiro',
  unauthorized_attempt: 'Tentativa Não Autorizada',
  admin_panel_access: 'Acesso ao Painel Admin'
};

const ACTION_COLORS = {
  user_approved: 'text-green-400',
  user_rejected: 'text-yellow-400',
  user_blocked: 'text-red-400',
  role_changed: 'text-blue-400',
  access_removed: 'text-red-400',
  financial_access: 'text-primary',
  unauthorized_attempt: 'text-red-500',
  admin_panel_access: 'text-primary'
};

export default function AuditLog() {
  const { user } = useAuth();

  const { data: logs = [] } = useQuery({
    queryKey: ['security-logs'],
    queryFn: () => base44.entities.SecurityLog.list('-created_date', 50),
    enabled: !!user
  });

  if (!logs.length) {
    return (
      <Card className="bg-card border-border p-6 text-center">
        <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">Nenhum evento registrado</p>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/50">
            <TableHead className="text-xs uppercase text-muted-foreground">Data/Hora</TableHead>
            <TableHead className="text-xs uppercase text-muted-foreground">Ação</TableHead>
            <TableHead className="text-xs uppercase text-muted-foreground">Usuário</TableHead>
            <TableHead className="text-xs uppercase text-muted-foreground">Realizado Por</TableHead>
            <TableHead className="text-xs uppercase text-muted-foreground">Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="hover:bg-secondary/20">
              <TableCell className="text-xs text-muted-foreground">
                {format(new Date(log.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </TableCell>
              <TableCell>
                <span className={`text-sm font-semibold ${ACTION_COLORS[log.action] || 'text-foreground'}`}>
                  {ACTION_LABELS[log.action] || log.action}
                </span>
              </TableCell>
              <TableCell className="text-sm text-foreground font-mono">{log.user_email}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{log.performed_by}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                {log.details}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}