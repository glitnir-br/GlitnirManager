import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, Search, ShieldCheck, ShieldOff, Trash2, UserPlus, Users, XCircle } from 'lucide-react';

import { base44, supabase } from '@/api/dbClient';
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
  visitante: { label: 'Visitante', profileRole: 'visitante' },
  adm_principal: { label: 'ADM Principal', profileRole: 'adm_principal' },
};
const EDITABLE_ROLES = Object.keys(ROLES).filter((role) => role !== 'adm_principal');
const ADMIN_ROLES = ['adm_principal', 'administrador'];
const statusStyle = { pendente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', aprovado: 'bg-green-500/20 text-green-400 border-green-500/30', bloqueado: 'bg-red-500/20 text-red-400 border-red-500/30' };
const actionLabels = { approve: 'Aprovar acesso', block: 'Bloquear acesso', unblock: 'Desbloquear acesso', role: 'Alterar cargo', delete: 'Excluir acesso' };
const formatDate = (date) => date ? format(new Date(date), 'dd/MM/yyyy HH:mm') : '-';
const profileStatusToAccessStatus = (status) => status === 'bloqueado' ? 'bloqueado' : status === 'pendente' ? 'pendente' : 'aprovado';

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

  const accessRows = useMemo(() => {
    const requestsByEmail = new Map();
    requests.forEach((request) => {
      const key = request.email?.toLowerCase();
      if (key && !requestsByEmail.has(key)) requestsByEmail.set(key, request);
    });
    const rows = profiles.map((profile) => {
      const request = requestsByEmail.get(profile.email?.toLowerCase());
      return {
        key: `profile_${profile.id}`,
        email: profile.email,
        profile,
        request,
        status: request?.status || profileStatusToAccessStatus(profile.status),
        role: request?.role || profile.role || 'visitante',
        createdDate: request?.created_date || profile.created_date,
      };
    });
    const profileEmails = new Set(profiles.map((profile) => profile.email?.toLowerCase()));
    requests.filter((request) => !profileEmails.has(request.email?.toLowerCase())).forEach((request) => {
      rows.push({ key: `request_${request.id}`, email: request.email, profile: null, request, status: request.status, role: request.role || 'visitante', createdDate: request.created_date });
    });
    return rows.sort((a, b) => new Date(b.createdDate || 0) - new Date(a.createdDate || 0));
  }, [profiles, requests]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
  };
  const isProtected = (row) => row.email?.toLowerCase() === user?.email?.toLowerCase() || row.profile?.role === 'adm_principal' || row.role === 'adm_principal';
  const logAction = (action, email, details) => base44.entities.SecurityLog.create({ action, user_email: email, performed_by: user.email, details, timestamp: new Date().toISOString() });
  const upsertProfile = async (row, changes) => row.profile
    ? base44.entities.UserProfile.update(row.profile.id, changes)
    : base44.entities.UserProfile.create({ email: row.email, ...changes });
  const upsertRequest = async (row, changes) => row.request
    ? base44.entities.AccessRequest.update(row.request.id, changes)
    : base44.entities.AccessRequest.create({ email: row.email, ...changes });

  const actionMutation = useMutation({
    mutationFn: async ({ type, row, role, justification }) => {
      if (['block', 'delete', 'role'].includes(type) && isProtected(row)) throw new Error('Não é permitido alterar, bloquear ou excluir a própria conta ou o ADM Principal.');
      const selectedRole = ROLES[role] ? role : 'visitante';
      if (type === 'approve') {
        await upsertRequest(row, { status: 'aprovado', role: selectedRole });
        await upsertProfile(row, { role: ROLES[selectedRole].profileRole, status: 'ativo', approved_by: user.email, approved_date: new Date().toISOString() });
        await base44.integrations.Core.SendEmail({ to: row.email, subject: 'Acesso liberado — Glitnir Manager', body: `Seu acesso foi liberado como ${ROLES[selectedRole].label}.` });
      }
      if (type === 'block') {
        await upsertRequest(row, { status: 'bloqueado', role: selectedRole });
        await upsertProfile(row, { role: 'bloqueado', status: 'bloqueado' });
        await base44.integrations.Core.SendEmail({ to: row.email, subject: 'Acesso bloqueado — Glitnir Manager', body: 'Seu acesso ao sistema foi bloqueado.' });
      }
      if (type === 'unblock') {
        await upsertRequest(row, { status: 'pendente', role: selectedRole });
        await upsertProfile(row, { role: 'pendente', status: 'pendente' });
      }
      if (type === 'role') {
        await upsertRequest(row, { status: 'aprovado', role: selectedRole });
        await upsertProfile(row, { role: ROLES[selectedRole].profileRole, status: 'ativo' });
      }
      if (type === 'delete') {
        if (row.request) await base44.entities.AccessRequest.delete(row.request.id);
        if (row.profile) await base44.entities.UserProfile.delete(row.profile.id);
      }
      await logAction(`access_${type}`, row.email, `${actionLabels[type]}. Cargo: ${ROLES[selectedRole]?.label || '-'}${justification ? `. Justificativa: ${justification}` : ''}`);
    },
    onSuccess: () => { invalidate(); setActionDialog(null); setReason(''); },
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('Digite um e-mail válido.');
      if (accessRows.some((row) => row.email?.toLowerCase() === normalizedEmail)) throw new Error('Este e-mail já possui um acesso registrado.');
      if (!supabase) throw new Error('A criação de acesso exige conexão com o Supabase.');
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const response = await fetch('/api/create-access-user', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ email: normalizedEmail, role: ROLES[role].profileRole }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao criar acesso.');
      return result;
      await base44.integrations.Core.SendEmail({ to: normalizedEmail, subject: 'Acesso liberado — Glitnir Manager', body: `Você foi adicionado como ${ROLES[role].label}.` });
      await logAction('access_invite', normalizedEmail, `Acesso criado manualmente como ${ROLES[role].label}.`);
    },
    onSuccess: (result) => { invalidate(); setInviteSuccess(`Acesso criado. Senha temporária: ${result.temporaryPassword}`); window.alert(`Acesso criado com sucesso.\n\nSenha temporária de ${result.email}:\n${result.temporaryPassword}\n\nGuarde e entregue esta senha ao usuário. Ela será obrigatoriamente alterada no primeiro login.`); setInviteEmail(''); setInviteRole('visitante'); },
    onError: (error) => setInviteError(error.message),
  });

  const filteredRows = accessRows.filter((row) => (!search || row.email?.toLowerCase().includes(search.toLowerCase())) && (statusFilter === 'todos' || row.status === statusFilter));
  const pending = accessRows.filter((row) => row.status === 'pendente').length;
  const approved = accessRows.filter((row) => row.status === 'aprovado').length;
  const blocked = accessRows.filter((row) => row.status === 'bloqueado').length;
  const openAction = (type, row, role = row.role) => { setReason(''); setActionDialog({ type, row, role }); };

  if (!ADMIN_ROLES.includes(user?.role)) return <div className="flex h-64 flex-col items-center justify-center gap-4 text-center"><ShieldOff className="h-12 w-12 text-muted-foreground" /><h2 className="text-xl font-semibold">Acesso negado</h2><p className="text-sm text-muted-foreground">Você não possui permissão para acessar esta área.</p></div>;
  if (requestsLoading || profilesLoading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>;

  return <FinancialPasswordProtection module="configuracoes"><div className="space-y-6"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15"><Users className="h-5 w-5 text-primary" /></div><div><h1 className="text-2xl font-bold text-foreground md:text-3xl">Gerenciamento de acesso</h1><p className="mt-0.5 text-sm text-muted-foreground">Aprove, bloqueie e acompanhe todos os perfis do sistema.</p></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><StatusCard label="Pendentes" value={pending} color="text-yellow-400" onClick={() => setStatusFilter('pendente')} /><StatusCard label="Ativos" value={approved} color="text-green-400" onClick={() => setStatusFilter('aprovado')} /><StatusCard label="Bloqueados" value={blocked} color="text-red-400" onClick={() => setStatusFilter('bloqueado')} /></div><div className="rounded-xl border border-border bg-secondary/40 p-4"><div className="mb-3 flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Adicionar acesso manualmente</span></div><form onSubmit={(event) => { event.preventDefault(); setInviteError(''); setInviteSuccess(''); inviteMutation.mutate({ email: inviteEmail, role: inviteRole }); }} className="flex flex-col items-end gap-3 sm:flex-row"><div className="w-full flex-1 space-y-1"><Label className="text-xs text-muted-foreground">E-mail</Label><Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="email@exemplo.com" className="h-9 bg-secondary" /></div><div className="w-full space-y-1 sm:w-40"><Label className="text-xs text-muted-foreground">Cargo</Label><RoleSelect value={inviteRole} onValueChange={setInviteRole} /></div><Button type="submit" disabled={inviteMutation.isPending} className="h-9 bg-primary hover:bg-primary/90"><UserPlus className="mr-2 h-4 w-4" />Adicionar</Button></form>{inviteError && <p className="mt-2 text-xs text-red-400">{inviteError}</p>}{inviteSuccess && <p className="mt-2 text-xs text-green-400">{inviteSuccess}</p>}</div><div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por e-mail..." className="bg-secondary pl-9" /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os status</SelectItem><SelectItem value="pendente">Pendentes</SelectItem><SelectItem value="aprovado">Ativos</SelectItem><SelectItem value="bloqueado">Bloqueados</SelectItem></SelectContent></Select></div></div><div className="overflow-x-auto rounded-xl border border-border"><Table><TableHeader><TableRow className="bg-secondary/50 hover:bg-secondary/50"><TableHead>E-mail</TableHead><TableHead>Status</TableHead><TableHead>Cargo</TableHead><TableHead>Criado em</TableHead><TableHead>Aprovado por</TableHead><TableHead className="w-64">Ações</TableHead></TableRow></TableHeader><TableBody>{!filteredRows.length ? <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">Nenhum acesso encontrado</TableCell></TableRow> : filteredRows.map((row) => { const protectedAccount = isProtected(row); const selectedRole = pendingRoles[row.key] || (ROLES[row.role] ? row.role : 'visitante'); return <TableRow key={row.key} className="hover:bg-secondary/30"><TableCell><div className="font-medium text-foreground">{row.email}</div>{protectedAccount && <span className="text-xs text-primary">Conta protegida</span>}</TableCell><TableCell><Badge variant="outline" className={statusStyle[row.status]}>{row.status}</Badge></TableCell><TableCell>{row.status === 'pendente' ? <RoleSelect value={selectedRole} onValueChange={(role) => setPendingRoles((current) => ({ ...current, [row.key]: role }))} /> : row.status === 'aprovado' && !protectedAccount ? <RoleSelect value={selectedRole} onValueChange={(role) => openAction('role', row, role)} /> : <span className="text-sm text-muted-foreground">{ROLES[row.role]?.label || row.role || '-'}</span>}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(row.createdDate)}</TableCell><TableCell className="text-xs text-muted-foreground">{row.profile?.approved_by || '-'}<br />{formatDate(row.profile?.approved_date)}</TableCell><TableCell><div className="flex flex-wrap gap-1">{row.status === 'pendente' && <><Button size="sm" variant="ghost" className="text-green-400 hover:bg-green-500/20" onClick={() => openAction('approve', row, selectedRole)}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Aprovar</Button><Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/20" disabled={protectedAccount} onClick={() => openAction('block', row)}><XCircle className="mr-1 h-3.5 w-3.5" />Negar</Button></>}{row.status === 'aprovado' && <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/20" disabled={protectedAccount} onClick={() => openAction('block', row)}><ShieldOff className="mr-1 h-3.5 w-3.5" />Bloquear</Button>}{row.status === 'bloqueado' && <Button size="sm" variant="ghost" className="text-yellow-400 hover:bg-yellow-500/20" onClick={() => openAction('unblock', row)}><ShieldCheck className="mr-1 h-3.5 w-3.5" />Desbloquear</Button>}<Button size="sm" variant="ghost" disabled={protectedAccount} className="text-muted-foreground hover:bg-red-500/10 hover:text-red-400" onClick={() => openAction('delete', row)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>; })}</TableBody></Table></div><Dialog open={Boolean(actionDialog)} onOpenChange={(open) => !open && setActionDialog(null)}><DialogContent className="max-w-md border-border bg-card"><DialogHeader><DialogTitle>{actionDialog && actionLabels[actionDialog.type]}</DialogTitle></DialogHeader><div className="space-y-3"><p className="text-sm text-muted-foreground">Conta: <strong className="text-foreground">{actionDialog?.row.email}</strong></p><div className="space-y-2"><Label>Justificativa <span className="text-muted-foreground">(opcional)</span></Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Registre o motivo desta ação..." rows={3} /></div></div><DialogFooter><Button variant="outline" onClick={() => setActionDialog(null)}>Cancelar</Button><Button disabled={actionMutation.isPending} className={actionDialog?.type === 'delete' || actionDialog?.type === 'block' ? 'bg-destructive hover:bg-destructive/90' : ''} onClick={() => actionMutation.mutate({ ...actionDialog, justification: reason.trim() })}>{actionMutation.isPending ? 'Salvando...' : 'Confirmar'}</Button></DialogFooter></DialogContent></Dialog></div></FinancialPasswordProtection>;
}

function RoleSelect({ value, onValueChange }) { return <Select value={value} onValueChange={onValueChange}><SelectTrigger className="h-8 w-full bg-secondary text-xs sm:w-40"><SelectValue /></SelectTrigger><SelectContent>{EDITABLE_ROLES.map((key) => <SelectItem key={key} value={key}>{ROLES[key].label}</SelectItem>)}</SelectContent></Select>; }
function StatusCard({ label, value, color, onClick }) { return <button type="button" onClick={onClick} className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-secondary/50"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p></button>; }
