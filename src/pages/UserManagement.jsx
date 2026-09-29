import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useAdminAuth } from '@/lib/AdminAuthContext';
import PasswordProtectedArea from '@/components/PasswordProtectedArea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge, RoleBadge } from '@/components/UserStatusBadge';
import { CheckCircle2, XCircle, Lock, Trash2, Settings, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function UserManagement() {
  const { user } = useAuth();
  const { logSecurityAction } = useAdminAuth();
  const [searchEmail, setSearchEmail] = useState('');
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['user-profiles'],
    queryFn: () => base44.entities.UserProfile.list('-created_date'),
  });

  const approveMutation = useMutation({
    mutationFn: (id) =>
      base44.entities.UserProfile.update(id, {
        status: 'ativo',
        approved_by: user.email,
        approved_date: new Date().toISOString(),
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      await logSecurityAction('user_approved', '', user.email);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id) =>
      base44.entities.UserProfile.update(id, {
        status: 'inativo',
        approved_by: user.email,
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      await logSecurityAction('user_rejected', '', user.email);
    },
  });

  const blockMutation = useMutation({
    mutationFn: ({ id, email }) => {
      // Proteger emails do ADM Principal
      const ADMIN_EMAILS = ['empreendedor.padilha1998@gmail.com', 'victorpadilha1998@gmail.com'];
      if (ADMIN_EMAILS.includes(email)) {
        throw new Error('Não é possível bloquear o ADM Principal');
      }
      return base44.entities.UserProfile.update(id, {
        status: 'bloqueado',
        role: 'bloqueado',
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      await logSecurityAction('user_blocked', '', user.email);
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, newRole, email }) => {
      // Proteger emails do ADM Principal
      const ADMIN_EMAILS = ['empreendedor.padilha1998@gmail.com', 'victorpadilha1998@gmail.com'];
      if (ADMIN_EMAILS.includes(email)) {
        throw new Error('Não é possível alterar o cargo do ADM Principal');
      }
      return base44.entities.UserProfile.update(id, { role: newRole });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      await logSecurityAction('role_changed', '', user.email);
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

  const filteredProfiles = profiles.filter((p) =>
    p.email.toLowerCase().includes(searchEmail.toLowerCase())
  );

  const pendingProfiles = filteredProfiles.filter((p) => p.status === 'pendente');
  const activeProfiles = filteredProfiles.filter((p) => p.status === 'ativo');
  const blockedProfiles = filteredProfiles.filter((p) => p.status === 'bloqueado');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PasswordProtectedArea title="Gerenciamento de Usuários">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground mt-1">
            Aprovações de usuários, atribuição de cargos e logs de segurança
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Input
            placeholder="Pesquisar por email..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            className="bg-secondary max-w-xs"
          />
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              Pendentes ({pendingProfiles.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2">
              Aprovados ({activeProfiles.length})
            </TabsTrigger>
            <TabsTrigger value="blocked" className="gap-2">
              Bloqueados ({blockedProfiles.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead>Email</TableHead>
                    <TableHead>Solicitado em</TableHead>
                    <TableHead className="w-48">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Nenhuma solicitação pendente
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingProfiles.map((profile) => (
                      <TableRow key={profile.id} className="hover:bg-secondary/30">
                        <TableCell className="font-medium">{profile.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(profile.created_date), 'dd MMM yyyy HH:mm', {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => approveMutation.mutate(profile.id)}
                              className="text-green-400 hover:bg-green-500/20"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rejectMutation.mutate(profile.id)}
                              className="text-red-400 hover:bg-red-500/20"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Recusar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead>Email</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Aprovado em</TableHead>
                    <TableHead className="w-64">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário aprovado
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeProfiles.map((profile) => (
                      <TableRow key={profile.id} className="hover:bg-secondary/30">
                        <TableCell className="font-medium">{profile.email}</TableCell>
                        <TableCell>
                          <RoleBadge role={profile.role} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {profile.approved_date
                            ? format(new Date(profile.approved_date), 'dd MMM yyyy', {
                                locale: ptBR,
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <select
                               value={profile.role}
                               onChange={(e) =>
                                 changeRoleMutation.mutate({
                                   id: profile.id,
                                   newRole: e.target.value,
                                   email: profile.email,
                                 })
                               }
                               className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground"
                               disabled={['empreendedor.padilha1998@gmail.com', 'victorpadilha1998@gmail.com'].includes(profile.email)}
                               title={['empreendedor.padilha1998@gmail.com', 'victorpadilha1998@gmail.com'].includes(profile.email) ? 'ADM Principal não pode ter cargo alterado' : ''}
                             >
                              <option value="usuario_comum">Usuário Comum</option>
                              <option value="moderador">Moderador</option>
                              <option value="financeiro">Financeiro</option>
                              <option value="administrador">Administrador</option>
                              <option value="adm_principal">ADM Principal</option>
                            </select>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => blockMutation.mutate({ id: profile.id, email: profile.email })}
                              className="text-red-400 hover:bg-red-500/20"
                              disabled={['empreendedor.padilha1998@gmail.com', 'victorpadilha1998@gmail.com'].includes(profile.email)}
                              title={['empreendedor.padilha1998@gmail.com', 'victorpadilha1998@gmail.com'].includes(profile.email) ? 'ADM Principal não pode ser bloqueado' : ''}
                            >
                              <Lock className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="blocked" className="space-y-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead>Email</TableHead>
                    <TableHead>Bloqueado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário bloqueado
                      </TableCell>
                    </TableRow>
                  ) : (
                    blockedProfiles.map((profile) => (
                      <TableRow key={profile.id} className="hover:bg-secondary/30">
                        <TableCell className="font-medium">{profile.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(profile.updated_date), 'dd MMM yyyy', {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell>
                           <Button
                             size="sm"
                             variant="ghost"
                             onClick={() =>
                               changeRoleMutation.mutate({
                                 id: profile.id,
                                 newRole: 'usuario_comum',
                                 email: profile.email,
                               })
                             }
                             className="text-green-400 hover:bg-green-500/20"
                           >
                             <CheckCircle2 className="w-4 h-4 mr-1" />
                             Desbloquear
                           </Button>
                         </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PasswordProtectedArea>
  );
}