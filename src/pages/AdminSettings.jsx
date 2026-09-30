import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/dbClient';
import PasswordProtectedArea from '@/components/PasswordProtectedArea';
import FinancialPasswordField from '@/components/settings/FinancialPasswordField';
import GcTabelaEditor from '@/components/settings/GcTabelaEditor';
import DataResetPanel from '@/components/settings/DataResetPanel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X } from 'lucide-react';

const ROLE_MAP = {
  nenhum:       { label: 'Nenhum',     profileRole: 'visitante',    profileStatus: 'ativo' },
  administrador:{ label: 'Admin',      profileRole: 'administrador', profileStatus: 'ativo' },
  financeiro:   { label: 'Financeiro', profileRole: 'financeiro',   profileStatus: 'ativo' },
  moderador:    { label: 'Moderador',  profileRole: 'moderador',    profileStatus: 'ativo' },
  suporte:      { label: 'Suporte',    profileRole: 'suporte',      profileStatus: 'ativo' },
  visitante:    { label: 'Visitante',  profileRole: 'visitante',    profileStatus: 'ativo' },
};

export default function AdminSettings() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('password');
  const [pendingRoles, setPendingRoles] = useState({});

  const queryClient = useQueryClient();

  const { data: accessRequests = [] } = useQuery({
    queryKey: ['accessRequests'],
    queryFn: () => base44.entities.AccessRequest.list('-created_date'),
  });

  const deleteBlockedMutation = useMutation({
    mutationFn: async () => {
      const blockedRequests = accessRequests.filter(r => r.status === 'bloqueado');
      for (const request of blockedRequests) {
        await base44.entities.AccessRequest.delete(request.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessRequests'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, email, role }) => {
      const { profileRole, profileStatus } = ROLE_MAP[role] || ROLE_MAP.nenhum;
      // Atualizar AccessRequest
      await base44.entities.AccessRequest.update(id, { status: 'aprovado', role });
      // Atualizar UserProfile
      const profiles = await base44.entities.UserProfile.filter({ email });
      if (profiles.length > 0) {
        await base44.entities.UserProfile.update(profiles[0].id, { role: profileRole, status: profileStatus });
      }
      // Enviar email de aprovação
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: 'Acesso Liberado - Glitnir Nexus',
        body: `Olá! Seu acesso ao Glitnir Nexus foi <strong>liberado</strong> com o cargo de <strong>${ROLE_MAP[role]?.label || 'Usuário'}</strong>. Você já pode entrar no sistema.`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessRequests'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, email }) => {
      await base44.entities.AccessRequest.update(id, { status: 'bloqueado' });
      // Atualizar UserProfile
      const profiles = await base44.entities.UserProfile.filter({ email });
      if (profiles.length > 0) {
        await base44.entities.UserProfile.update(profiles[0].id, { role: 'bloqueado', status: 'bloqueado' });
      }
      // Enviar email de bloqueio
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: 'Acesso Negado - Glitnir Nexus',
        body: `Olá! Infelizmente seu acesso ao Glitnir Nexus foi <strong>negado</strong>. Entre em contato com o administrador se achar que isso foi um engano.`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessRequests'] });
    },
  });



  // Apenas ADM Principal pode acessar
  if (user?.role !== 'adm_principal') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Acesso restrito a ADM Principal.</p>
      </div>
    );
  }

  return (
    <PasswordProtectedArea title="Configurações Administrativas">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações de Administrador</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie segurança, permissões e atividades do sistema
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid h-auto w-full max-w-2xl grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="password" className="gap-2">Senhas de Acesso</TabsTrigger>
            <TabsTrigger value="access" className="gap-2">Solicitações de Acesso</TabsTrigger>
            <TabsTrigger value="gc" className="gap-2">Tabela GC</TabsTrigger>
            <TabsTrigger value="reset" className="gap-2 text-destructive">Reset de Dados</TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <div className="mx-auto max-w-2xl space-y-6 rounded-xl border border-border bg-card p-4 sm:p-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Senhas de Acesso aos Módulos</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Defina a senha que será usada para acessar as áreas de Doações/GC, Pacotes de Guildas e Despesas. Senha padrão: <span className="font-semibold text-primary">Pituca00</span>
                </p>

                <div className="space-y-6">
                   <FinancialPasswordField title="Doações/GC" module="doacoes" />
                   <div className="border-t border-border pt-6"></div>
                   <FinancialPasswordField title="Pacotes Guildas" module="compras" />
                   <div className="border-t border-border pt-6"></div>
                   <FinancialPasswordField title="Despesas" module="despesas" />
                   <div className="border-t border-border pt-6"></div>
                   <FinancialPasswordField title="Configurações" module="configuracoes" />
                   <div className="border-t border-border pt-6"></div>
                   <FinancialPasswordField title="Segurança" module="seguranca" />
                 </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="access">
            <div className="mx-auto max-w-4xl rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Solicitações de Acesso</h2>
                  <p className="text-muted-foreground text-sm">
                    Aprove ou rejeite solicitações de acesso de novos usuários
                  </p>
                </div>
                {accessRequests.some(r => r.status === 'bloqueado') && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteBlockedMutation.mutate()}
                    disabled={deleteBlockedMutation.isPending}
                  >
                    Apagar Bloqueados
                  </Button>
                )}
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-xs uppercase">Email</TableHead>
                      <TableHead className="text-xs uppercase">Cargo</TableHead>
                      <TableHead className="text-xs uppercase">Status</TableHead>
                      <TableHead className="text-xs uppercase">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Nenhuma solicitação
                        </TableCell>
                      </TableRow>
                    ) : accessRequests.map(request => (
                      <TableRow key={request.id} className="hover:bg-secondary/30">
                        <TableCell className="text-foreground font-medium">{request.email}</TableCell>
                        <TableCell>
                          {request.status === 'pendente' ? (
                            <Select
                              value={pendingRoles[request.id] || 'nenhum'}
                              onValueChange={(val) => setPendingRoles(prev => ({ ...prev, [request.id]: val }))}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="administrador">Admin</SelectItem>
                                <SelectItem value="financeiro">Financeiro</SelectItem>
                                <SelectItem value="moderador">Moderador</SelectItem>
                                <SelectItem value="suporte">Suporte</SelectItem>
                                <SelectItem value="visitante">Visitante</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">{ROLE_MAP[request.role]?.label || request.role}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={request.status === 'pendente' ? 'secondary' : request.status === 'aprovado' ? 'outline' : 'destructive'}>
                            {request.status === 'pendente' ? 'Aguardando' : request.status === 'aprovado' ? 'Liberado' : 'Bloqueado'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {request.status === 'pendente' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-500 hover:bg-green-500/10"
                                  onClick={() => approveMutation.mutate({ id: request.id, email: request.email, role: pendingRoles[request.id] || 'nenhum' })}
                                  disabled={approveMutation.isPending || rejectMutation.isPending}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:bg-red-500/10"
                                  onClick={() => rejectMutation.mutate({ id: request.id, email: request.email })}
                                  disabled={approveMutation.isPending || rejectMutation.isPending}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gc">
            <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-4 sm:p-6">
              <GcTabelaEditor />
            </div>
          </TabsContent>

          <TabsContent value="reset">
            <div className="mx-auto max-w-2xl rounded-xl border border-destructive/30 bg-card p-4 sm:p-6">
              <DataResetPanel />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PasswordProtectedArea>
  );
}
