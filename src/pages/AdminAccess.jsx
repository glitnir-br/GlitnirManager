import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, Trash2, ShieldCheck, ShieldOff, Users, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import FinancialPasswordProtection from '@/components/FinancialPasswordProtection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ROLE_MAP = {
  nenhum:       { label: 'Nenhum',       profileRole: 'visitante',    profileStatus: 'ativo' },
  administrador:{ label: 'Admin',        profileRole: 'administrador', profileStatus: 'ativo' },
  financeiro:   { label: 'Financeiro',   profileRole: 'financeiro',   profileStatus: 'ativo' },
  moderador:    { label: 'Moderador',    profileRole: 'moderador',    profileStatus: 'ativo' },
  suporte:      { label: 'Suporte',      profileRole: 'suporte',      profileStatus: 'ativo' },
  visitante:    { label: 'Visitante',    profileRole: 'visitante',    profileStatus: 'ativo' },
};

const statusColor = {
  pendente:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  aprovado:  'bg-green-500/20 text-green-400 border-green-500/30',
  bloqueado: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const ADMIN_ROLES = ['adm_principal', 'administrador'];

export default function AdminAccess() {
  const { user } = useAuth();
  const [pendingRoles, setPendingRoles] = useState({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('visitante');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['access-requests'],
    queryFn: () => base44.entities.AccessRequest.list('-created_date'),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, email, role }) => {
      const { profileRole, profileStatus } = ROLE_MAP[role] || ROLE_MAP.nenhum;
      await base44.entities.AccessRequest.update(id, { status: 'aprovado', role });
      const profiles = await base44.entities.UserProfile.filter({ email });
      if (profiles.length > 0) {
        await base44.entities.UserProfile.update(profiles[0].id, {
          role: profileRole,
          status: profileStatus,
          approved_by: user.email,
          approved_date: new Date().toISOString(),
        });
      }
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: 'Acesso Liberado - Glitnir Nexus',
        body: `Seu acesso ao Glitnir Nexus foi <strong>liberado</strong> com o cargo de <strong>${ROLE_MAP[role]?.label || 'Visitante'}</strong>. Você já pode entrar no sistema.`
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-requests'] }),
  });

  const blockMutation = useMutation({
    mutationFn: async ({ id, email }) => {
      await base44.entities.AccessRequest.update(id, { status: 'bloqueado' });
      const profiles = await base44.entities.UserProfile.filter({ email });
      if (profiles.length > 0) {
        await base44.entities.UserProfile.update(profiles[0].id, { role: 'bloqueado', status: 'bloqueado' });
      }
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: 'Acesso Negado - Glitnir Nexus',
        body: `Seu acesso ao Glitnir Nexus foi <strong>negado</strong>. Entre em contato com o administrador se achar que isso foi um engano.`
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-requests'] }),
  });

  const unblockMutation = useMutation({
    mutationFn: async ({ id, email }) => {
      await base44.entities.AccessRequest.update(id, { status: 'pendente' });
      const profiles = await base44.entities.UserProfile.filter({ email });
      if (profiles.length > 0) {
        await base44.entities.UserProfile.update(profiles[0].id, { role: 'pendente', status: 'pendente' });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-requests'] }),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ id, email, role }) => {
      const { profileRole } = ROLE_MAP[role] || ROLE_MAP.nenhum;
      await base44.entities.AccessRequest.update(id, { role });
      const profiles = await base44.entities.UserProfile.filter({ email });
      if (profiles.length > 0) {
        await base44.entities.UserProfile.update(profiles[0].id, { role: profileRole });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-requests'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AccessRequest.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-requests'] }),
  });

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    if (!inviteEmail || !inviteEmail.includes('@')) {
      setInviteError('Digite um email válido');
      return;
    }
    const existing = requests.find(r => r.email === inviteEmail);
    if (existing) {
      setInviteError('Este email já está cadastrado');
      return;
    }
    const { profileRole, profileStatus } = ROLE_MAP[inviteRole] || ROLE_MAP.visitante;
    // Cria AccessRequest já aprovado
    await base44.entities.AccessRequest.create({ email: inviteEmail, status: 'aprovado', role: inviteRole });
    // Cria ou atualiza UserProfile
    const profiles = await base44.entities.UserProfile.filter({ email: inviteEmail });
    if (profiles.length > 0) {
      await base44.entities.UserProfile.update(profiles[0].id, { role: profileRole, status: profileStatus, approved_by: user.email, approved_date: new Date().toISOString() });
    } else {
      await base44.entities.UserProfile.create({ email: inviteEmail, role: profileRole, status: profileStatus, approved_by: user.email, approved_date: new Date().toISOString() });
    }
    // Convida para o app
    await base44.users.inviteUser(inviteEmail, 'user');
    await base44.integrations.Core.SendEmail({
      to: inviteEmail,
      subject: 'Acesso Liberado - Glitnir Nexus',
      body: `Você foi convidado para o Glitnir Nexus com o cargo de <strong>${ROLE_MAP[inviteRole]?.label || 'Visitante'}</strong>. Acesse o sistema com seu email.`
    });
    queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    setInviteSuccess(`Email ${inviteEmail} adicionado com sucesso!`);
    setInviteEmail('');
    setInviteRole('visitante');
  };

  if (!ADMIN_ROLES.includes(user?.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <ShieldOff className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Negado</h2>
        <p className="text-muted-foreground text-sm">Você não possui permissão para acessar esta área.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const pending   = requests.filter(r => r.status === 'pendente');
  const aprovados = requests.filter(r => r.status === 'aprovado');
  const bloqueados = requests.filter(r => r.status === 'bloqueado');

  return (
    <FinancialPasswordProtection module="configuracoes">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gerenciamento de Acesso</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {pending.length} pendente{pending.length !== 1 ? 's' : ''} · {aprovados.length} aprovado{aprovados.length !== 1 ? 's' : ''} · {bloqueados.length} bloqueado{bloqueados.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Adicionar email manualmente */}
        <div className="bg-secondary/40 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Adicionar Acesso Manualmente</span>
          </div>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="bg-secondary h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cargo</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-36 h-9 text-sm bg-secondary">
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
            </div>
            <Button type="submit" className="bg-primary hover:bg-primary/90 h-9">
              <UserPlus className="w-4 h-4 mr-2" /> Adicionar
            </Button>
          </form>
          {inviteError && <p className="text-red-400 text-xs mt-2">{inviteError}</p>}
          {inviteSuccess && <p className="text-green-400 text-xs mt-2">{inviteSuccess}</p>}
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Email</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Cargo</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground w-56">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    Nenhuma solicitação registrada
                  </TableCell>
                </TableRow>
              ) : requests.map(req => (
                <TableRow key={req.id} className="hover:bg-secondary/30">
                  <TableCell className="font-medium text-foreground">{req.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor[req.status]}>
                      {req.status === 'pendente' && '⏳ Pendente'}
                      {req.status === 'aprovado' && '✓ Aprovado'}
                      {req.status === 'bloqueado' && '✕ Bloqueado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {req.status === 'aprovado' ? (
                      <Select
                        value={req.role || 'nenhum'}
                        onValueChange={(val) => changeRoleMutation.mutate({ id: req.id, email: req.email, role: val })}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs bg-secondary">
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
                    ) : req.status === 'pendente' ? (
                      <Select
                        value={pendingRoles[req.id] || 'visitante'}
                        onValueChange={(val) => setPendingRoles(prev => ({ ...prev, [req.id]: val }))}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs bg-secondary">
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
                      <span className="text-muted-foreground text-sm">{ROLE_MAP[req.role]?.label || '—'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {req.status === 'pendente' && (
                        <>
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => approveMutation.mutate({ id: req.id, email: req.email, role: pendingRoles[req.id] || 'visitante' })}
                            disabled={approveMutation.isPending}
                            className="text-green-400 hover:bg-green-500/20 text-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => blockMutation.mutate({ id: req.id, email: req.email })}
                            disabled={blockMutation.isPending}
                            className="text-red-400 hover:bg-red-500/20 text-xs"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Negar
                          </Button>
                        </>
                      )}
                      {req.status === 'aprovado' && (
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => blockMutation.mutate({ id: req.id, email: req.email })}
                          disabled={blockMutation.isPending}
                          className="text-red-400 hover:bg-red-500/20 text-xs"
                        >
                          <ShieldOff className="w-3.5 h-3.5 mr-1" /> Bloquear
                        </Button>
                      )}
                      {req.status === 'bloqueado' && (
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => unblockMutation.mutate({ id: req.id, email: req.email })}
                          disabled={unblockMutation.isPending}
                          className="text-yellow-400 hover:bg-yellow-500/20 text-xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Desbloquear
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => deleteMutation.mutate(req.id)}
                        disabled={deleteMutation.isPending}
                        className="text-muted-foreground hover:bg-red-500/10 hover:text-red-400 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </FinancialPasswordProtection>
  );
}
