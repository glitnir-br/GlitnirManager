import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/dbClient';
import { useAuth } from '@/lib/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Shield } from 'lucide-react';

const ACTION_LABELS = {
  user_approved: 'Usuário Aprovado',
  user_rejected: 'Usuário Rejeitado',
  user_blocked: 'Usuário Bloqueado',
  role_changed: 'Role Alterada',
  access_removed: 'Acesso Removido',
  financial_access: 'Acesso Financeiro',
  unauthorized_attempt: 'Tentativa Não Autorizada',
  admin_panel_access: 'Acesso ao Painel Admin',
  data_create: 'Dado adicionado',
  data_update: 'Dado modificado',
  data_delete: 'Dado excluído',
  data_bulk_update: 'Dados modificados em lote',
  data_bulk_delete: 'Dados excluídos em lote',
};

const ACTION_COLORS = {
  user_approved: 'text-green-400',
  user_rejected: 'text-yellow-400',
  user_blocked: 'text-red-400',
  role_changed: 'text-blue-400',
  access_removed: 'text-red-400',
  financial_access: 'text-primary',
  unauthorized_attempt: 'text-red-500',
  admin_panel_access: 'text-primary',
  data_create: 'text-green-400',
  data_update: 'text-blue-400',
  data_delete: 'text-red-400',
  data_bulk_update: 'text-blue-400',
  data_bulk_delete: 'text-red-400',
};

const formatDetails = (details) => {
  try {
    const parsed = JSON.parse(details);
    const entries = Object.entries(parsed).filter(([key]) => key !== 'entidade');
    return `${parsed.entidade || 'Sistema'}${entries.length ? ` — ${entries.map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ')}` : ''}`;
  } catch {
    return details || '-';
  }
};

export default function AuditLog() {
  const { user } = useAuth();
  const [selectedLog, setSelectedLog] = useState(null);

  const { data: logs = [] } = useQuery({
    queryKey: ['security-logs'],
    queryFn: () => base44.entities.SecurityLog.list('-created_date', 50),
    enabled: !!user
  });

  if (!logs.length) {
    return (
      <Card className="w-full border-border bg-card p-6 text-center">
        <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">Nenhum evento registrado</p>
      </Card>
    );
  }

  return (
    <Card className="w-full overflow-hidden border-border bg-card">
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead className="text-xs uppercase text-muted-foreground">Data/Hora</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Ação</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Usuário</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Realizado Por</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Detalhes</TableHead>
              <TableHead className="w-28" />
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
                <TableCell className="max-w-64 truncate text-xs text-muted-foreground" title={formatDetails(log.details)}>
                  {formatDetails(log.details).length > 110 ? `${formatDetails(log.details).slice(0, 110)}…` : formatDetails(log.details)}
                </TableCell>
                <TableCell><Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setSelectedLog(log)}><Eye className="h-3.5 w-3.5" />Ver detalhes</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl overflow-hidden border-border bg-card">
          <DialogHeader><DialogTitle>Detalhes da auditoria</DialogTitle></DialogHeader>
          {selectedLog && <div className="min-w-0 space-y-3 text-sm"><div className="grid min-w-0 gap-2 sm:grid-cols-2"><p className="min-w-0 break-words"><span className="text-muted-foreground">Ação:</span> {ACTION_LABELS[selectedLog.action] || selectedLog.action}</p><p className="min-w-0 break-words"><span className="text-muted-foreground">Usuário:</span> {selectedLog.performed_by || selectedLog.user_email || '-'}</p></div><pre className="max-h-96 max-w-full overflow-auto whitespace-pre-wrap break-all rounded-lg bg-secondary p-3 font-mono text-xs text-foreground">{formatDetails(selectedLog.details)}</pre></div>}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
