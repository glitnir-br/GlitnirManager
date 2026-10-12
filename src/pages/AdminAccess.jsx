import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, Search, ShieldCheck, ShieldOff, Trash2, UserPlus, Users, XCircle } from 'lucide-react';

import { base44 } from '@/api/dbClient';
import FinancialPasswordProtection from '@/components/FinancialPasswordProtection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/AuthContext';

const ROLES = {
  administrador: { label: 'Administrador', profileRole: 'administrador' },
  financeiro: { label: 'Financeiro', profileRole: 'financeiro' },
  moderador: { label: 'Moderador', profileRole: 'moderador' },
  suporte: { label: 'Suporte', profileRole: 'suporte' },
  visitante: { label: 'Visitante', profileRole: 'visitante' },
};
const ADMIN_ROLES = ['adm_principal', 'administrador'];
const statusStyle = { pendente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', aprovado: 'bg-green-500/20 text-green-400 border-green-500/30', bloqueado: 'bg-red-500/20 text-red-400 border-red-500/30' };
const actionLabels = { approve: 'Aprovar acesso', block: 'Bloquear acesso', unblock: 'Desbloquear acesso', role: 'Alterar cargo', delete: 'Excluir acesso' };

const formatDate = (date) => date ? format(new Date(date), 'dd/MM/yyyy HH:mm') : '-';

export default function AdminAccess() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pendingRoles, setPendingRoles] = useState({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('visitante');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [actionDialog, setActionDialog] = useState(null);
  const [reason, setReason] = useState('');

  const { data: requests = [], isLoading: requestsLoading } = useQuery({ queryKey: ['access-requests'], queryFn: () => base44.entities.AccessRequest.list('-created_date') });
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({ queryKey: ['user-profiles'], queryFn: () => base44.entities.UserProfile.list() });
  const profilesByEmail = useMemo(() => new Map(profiles.map((profile) => [profile.email?.toLowerCase(), profile])), [profiles]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
  };
  const profileFor = (email) => profilesByEmail.get(email?.toLowerCase());
  const isProtected = (request) => request.email?.toLowerCase() === user?.email?.toLowerCase() || profileFor(request.email)?.role === 'adm_principal';
  const logAction = (action, targetEmail, details) => base44.entities.SecurityLog.create({ action, user_email: targetEmail, performed_by: user.email, details, timestamp: new Date().toISOString() });
  const saveProfile = async (email, changes) => {
    const profile = profileFor(email);
    if (profile) return base44.entities.UserProfile.update(profile.id, changes);
    return base44.entities.UserProfile.create({ email, ...changes });
  };

  const actionMutation = useMutation({
    mutationFn: async ({ type, request, role, justification }) => {
      if (['block', 'delete', 'role'].includes(type) && isProtected(request)) throw new Error('Não é permitido alterar, bloquear ou excluir a própria conta ou o ADM Principal.');
      const selectedRole = role || request.role || 'visitante';
      if (type === 'approve') {
        await base44.entities.AccessRequest.update(request.id, { status: 'aprovado', role: selectedRole });
        await saveProfile(request.email, { role: ROLES[selectedRole].profileRole, status: 'ativo', approved_by: user.email, approved_date: new Date().toISOString() });
        await base44.integrations.Core.SendEmail({ to: request.email, subject: 'Acesso liberado — Glitnir Manager', body: `Seu acesso foi liberado como ${ROLES[selectedRole].label}.` });
      }
      if (type === 'block') {
        await base44.entities.AccessRequest.update(request.id, { status: 'bloqueado' });
        await saveProfile(request.email, { role: 'bloqueado', status: 'bloqueado' });
        await base44.integrations.Core.SendEmail({ to: request.email, subject: 'Acesso bloqueado — Glitnir Manager', body: 'Seu acesso ao sistema foi bloqueado.' });
      }
      if (type === 'unblock') {
        await base44.entities.AccessRequest.update(request.id, { status: 'pendente' });
        await saveProfile(request.email, { role: 'pendente', status: 'pendente' });
      }
      if (type === 'role') {
        await base44.entities.AccessRequest.update(request.id, { role: selectedRole });
        await saveProfile(request.email, { role: ROLES[selectedRole].profileRole });
      }
      if (type === 'delete') await base44.entities.AccessRequest.delete(request.id);
      await logAction(`access_${type}`, request.email, `${actionLabels[type]}. Cargo: ${ROLES[selectedRole]?.label || '-'}${justification ? `. Justificativa: ${justification}` : ''}`);
    },
    onSuccess: () => { invalidate(); setActionDialog(null); setReason(''); },
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('Digite um e-mail válido.');
      if (requests.some((request) => request.email?.toLowerCase() === normalizedEmail)) throw new Error('Este e-mail já possui um acesso registrado.');
      await base44.entities.AccessRequest.create({ email: normalizedEmail, status: 'aprovado', role });
      await saveProfile(normalizedEmail, { role: ROLES[role].profileRole, status: 'ativo', approved_by: user.email, approved_date: new Date().toISOString() });
      await base44.users.inviteUser(normalizedEmail, 'user');
      await base44.integrations.Core.SendEmail({ to: normalizedEmail, subject: 'Acesso liberado — Glitnir Manager', body: `Você foi adicionado como ${ROLES[role].label}.` });
      await logAction('access_invite', normalizedEmail, `Acesso criado manualmente como ${ROLES[role].label}.`);
    },
    onSuccess: () => { invalidate(); setInviteSuccess('Acesso adicionado com sucesso.'); setInviteEmail(''); setInviteRole('visitante'); },
    onError: (error) => setInviteError(error.message),
  });

  const filteredRequests = requests.filter((request) => (
    (!search || request.email?.toLowerCase().includes(search.toLowerCase())) &&
    (statusFilter === 'todos' || request.status === statusFilter)
  ));
  const pending = requests.filter((request) => request.status === 'pendente').length;
  const approved = requests.filter((request) => request.status === 'aprovado').length;
  const blocked = requests.filter((request) => request.status === 'bloqueado').length;

  if (!ADMIN_ROLES.includes(user?.role)) return <div className="flex h-64 flex-col items-center justify-center gap-4 text-center"><ShieldOff className="h-12 w-12 text-muted-foreground" /><h2 className="text-xl font-semibold">Acesso negado</h2><p className="text-sm text-muted-foreground">Você não possui permissão para acessar esta área.</p></div>;
  if (requestsLoading || profilesLoading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>;

  const openAction = (type, request, role) => { setReason(''); setActionDialog({ type, request, role }); };

  return (
    <FinancialPasswordProtection module="configuracoes">
      <div className="space-y-6">
        <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15"><Users className="h-5 w-5 text-primary" /></div><div><h1 className="text-2xl font-bold text-foreground md:text-3xl">Gerenciamento de acesso</h1><p className="mt-0.5 text-sm text-muted-foreground">Aprove, bloqueie e acompanhe os acessos do sistema.</p></div></div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatusCard label="Pendentes" value={pending} color="text-yellow-400" onClick={() => setStatusFilter('pendente')} /><StatusCard label="Ativos" value={approved} color="text-green-400" onClick={() => setStatusFilter('aprovado')} /><StatusCard label="Bloqueados" value={blocked} color="text-red-400" onClick={() => setStatusFilter('bloqueado')} />
        </div>

        <div className="rounded-xl border border-border bg-secondary/40 p-4"><div className="mb-3 flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Adicionar acesso manualmente</span></div><form onSubmit={(event) => { event.preventDefault(); setInviteError(''); setInviteSuccess(''); inviteMutation.mutate({ email: inviteEmail, role: inviteRole }); }} className="flex flex-col items-end gap-3 sm:flex-row"><div className="w-full flex-1 space-y-1"><Label className="text-xs text-muted-foreground">E-mail</Label><Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="email@exemplo.com" className="h-9 bg-secondary" /></div><div className="w-full space-y-1 sm:w-40"><Label className="text-xs text-muted-foreground">Cargo</Label><RoleSelect value={inviteRole} onValueChange={setInviteRole} /></div><Button type="submit" disabled={inviteMutation.isPending} className="h-9 bg-primary hover:bg-primary/90"><UserPlus className="mr-2 h-4 w-4" />Adicionar</Button></form>{inviteError && <p className="mt-2 text-xs text-red-400">{inviteError}</p>}{inviteSuccess && <p className="mt-2 text-xs text-green-400">{inviteSuccess}</p>}</div>

        <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por e-mail..." className="bg-secondary pl-9" /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os status</SelectItem><SelectItem value="pendente">Pendentes</SelectItem><SelectItem value="aprovado">Ativos</SelectItem><SelectItem value="bloqueado">Bloqueados</SelectItem></SelectContent></Select></div></div>

        <div className="overflow-x-auto rounded-xl border border-border"><Table><TableHeader><TableRow className="bg-secondary/50 hover:bg-secondary/50"><TableHead>E-mail</TableHead><TableHead>Status</TableHead><TableHead>Cargo</TableHead><TableHead>Solicitado em</TableHead><TableHead>Aprovado por</TableHead><TableHead className="w-64">Ações</TableHead></TableRow></TableHeader><TableBody>{!filteredRequests.length ? <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">Nenhum acesso encontrado</TableCell></TableRow> : filteredRequests.map((request) => { const profile = profileFor(request.email); const protectedAccount = isProtected(request); const selectedRole = pendingRoles[request.id] || request.role || 'visitante'; return <TableRow key={request.id} className="hover:bg-secondary/30"><TableCell><div className="font-medium text-foreground">{request.email}</div>{protectedAccount && <span className="text-xs text-primary">Conta protegida</span>}</TableCell><TableCell><Badge variant="outline" className={statusStyle[request.status]}>{request.status}</Badge></TableCell><TableCell>{request.status === 'pendente' ? <RoleSelect value={selectedRole} onValueChange={(role) => setPendingRoles((current) => ({ ...current, [request.id]: role }))} /> : request.status === 'aprovado' && !protectedAccount ? <RoleSelect value={request.role || 'visitante'} onValueChange={(role) => openAction('role', request, role)} /> : <span className="text-sm text-muted-foreground">{ROLES[request.role]?.label || profile?.role || '-'}</span>}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(request.created_date)}</TableCell><TableCell className="text-xs text-muted-foreground">{profile?.approved_by || '-'}<br />{formatDate(profile?.approved_date)}</TableCell><TableCell><div className="flex flex-wrap gap-1">{request.status === 'pendente' && <><Button size="sm" variant="ghost" className="text-green-400 hover:bg-green-500/20" onClick={() => openAction('approve', request, selectedRole)}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Aprovar</Button><Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/20" disabled={protectedAccount} onClick={() => openAction('block', request)}><XCircle className="mr-1 h-3.5 w-3.5" />Negar</Button></>}{request.status === 'aprovado' && <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/20" disabled={protectedAccount} onClick={() => openAction('block', request)}><ShieldOff className="mr-1 h-3.5 w-3.5" />Bloquear</Button>}{request.status === 'bloqueado' && <Button size="sm" variant="ghost" className="text-yellow-400 hover:bg-yellow-500/20" onClick={() => openAction('unblock', request)}><ShieldCheck className="mr-1 h-3.5 w-3.5" />Desbloquear</Button>}<Button size="sm" variant="ghost" disabled={protectedAccount} className="text-muted-foreground hover:bg-red-500/10 hover:text-red-400" onClick={() => openAction('delete', request)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>; })}</TableBody></Table></div>

        <Dialog open={Boolean(actionDialog)} onOpenChange={(open) => !open && setActionDialog(null)}><DialogContent className="max-w-md border-border bg-card"><DialogHeader><DialogTitle>{actionDialog && actionLabels[actionDialog.type]}</DialogTitle></DialogHeader><div className="space-y-3"><p className="text-sm text-muted-foreground">Conta: <strong className="text-foreground">{actionDialog?.request.email}</strong></p><div className="space-y-2"><Label>Justificativa <span className="text-muted-foreground">(opcional)</span></Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Registre o motivo desta ação..." rows={3} /></div></div><DialogFooter><Button variant="outline" onClick={() => setActionDialog(null)}>Cancelar</Button><Button disabled={actionMutation.isPending} className={actionDialog?.type === 'delete' || actionDialog?.type === 'block' ? 'bg-destructive hover:bg-destructive/90' : ''} onClick={() => actionMutation.mutate({ ...actionDialog, justification: reason.trim() })}>{actionMutation.isPending ? 'Salvando...' : 'Confirmar'}</Button></DialogFooter></DialogContent></Dialog>
      </div>
    </FinancialPasswordProtection>
  );
}

function RoleSelect({ value, onValueChange }) { return <Select value={value} onValueChange={onValueChange}><SelectTrigger className="h-8 w-full bg-secondary text-xs sm:w-40"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ROLES).map(([key, role]) => <SelectItem key={key} value={key}>{role.label}</SelectItem>)}</SelectContent></Select>; }
function StatusCard({ label, value, color, onClick }) { return <button type="button" onClick={onClick} className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-secondary/50"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p></button>; }
