import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { base44 } from '@/api/dbClient';
import { PAGE_PERMISSIONS } from '@/lib/PermissionsContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEFAULT_ROLES = [
  { key: 'adm_principal', name: 'ADM Principal', system: true },
  { key: 'administrador', name: 'Administrador', system: true },
  { key: 'financeiro', name: 'Financeiro', system: true },
  { key: 'visitante', name: 'Visitante', system: true },
];
const DEFAULTS = {
  adm_principal: PAGE_PERMISSIONS.map(({ key }) => key),
  administrador: PAGE_PERMISSIONS.map(({ key }) => key),
  financeiro: ['dashboard', 'jogadores', 'financeiro'],
  visitante: ['dashboard', 'jogadores', 'mods'],
};
const keyFromName = (name) => name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export default function CargosPermissoes() {
  const { user } = useAuth(); const queryClient = useQueryClient();
  const [name, setName] = useState(''); const [selectedKey, setSelectedKey] = useState('administrador'); const [draft, setDraft] = useState(null); const [message, setMessage] = useState('');
  const { data: savedRoles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => base44.entities.Role.list() });
  const { data: permissionRows = [] } = useQuery({ queryKey: ['role-permissions'], queryFn: () => base44.entities.RolePermission.list() });
  const roles = useMemo(() => [...DEFAULT_ROLES, ...savedRoles.filter((role) => !DEFAULT_ROLES.some((item) => item.key === role.key))], [savedRoles]);
  const selectedPermissions = (key) => { const rows = permissionRows.filter((item) => item.role_key === key); return rows.length ? rows.filter((item) => item.allowed).map((item) => item.page_key) : (DEFAULTS[key] || []); };
  const current = draft ?? selectedPermissions(selectedKey);
  const selectRole = (key) => { setSelectedKey(key); setDraft(null); setMessage(''); };
  const createRole = useMutation({ mutationFn: async () => { const key = keyFromName(name); if (!key) throw new Error('Informe um nome para o cargo.'); if (roles.some((role) => role.key === key)) throw new Error('Já existe um cargo com este nome.'); return base44.entities.Role.create({ key, name: name.trim(), created_by: user.email }); }, onSuccess: (role) => { queryClient.invalidateQueries({ queryKey: ['roles'] }); setName(''); selectRole(role.key); }, onError: (error) => setMessage(error.message) });
  const savePermissions = useMutation({ mutationFn: async () => { if (selectedKey === 'adm_principal') return; const existing = permissionRows.filter((item) => item.role_key === selectedKey); await Promise.all(existing.map((item) => base44.entities.RolePermission.delete(item.id))); await Promise.all(PAGE_PERMISSIONS.map(({ key }) => base44.entities.RolePermission.create({ role_key: selectedKey, page_key: key, allowed: current.includes(key) }))); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['role-permissions'] }); setDraft(null); setMessage('Permissões salvas.'); }, onError: (error) => setMessage(error.message) });
  const removeRole = useMutation({ mutationFn: async () => { const role = savedRoles.find((item) => item.key === selectedKey); if (!role) return; await base44.entities.Role.delete(role.id); const perms = permissionRows.filter((item) => item.role_key === selectedKey); await Promise.all(perms.map((item) => base44.entities.RolePermission.delete(item.id))); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['roles'] }); queryClient.invalidateQueries({ queryKey: ['role-permissions'] }); selectRole('administrador'); } });
  if (user?.role !== 'adm_principal') return <p className="text-muted-foreground">Acesso restrito a ADM Principal.</p>;
  return <div className="space-y-6"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15"><ShieldCheck className="h-5 w-5 text-primary" /></div><div><h1 className="text-2xl font-bold text-foreground md:text-3xl">Cargos e permissões</h1><p className="mt-0.5 text-sm text-muted-foreground">Defina quais páginas cada cargo pode visualizar.</p></div></div><div className="grid gap-6 lg:grid-cols-[260px_1fr]"><Card className="border-border"><CardHeader><CardTitle>Cargos</CardTitle><CardDescription>Escolha um cargo para editar.</CardDescription></CardHeader><CardContent className="space-y-2">{roles.map((role) => <button key={role.key} type="button" onClick={() => selectRole(role.key)} className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${selectedKey === role.key ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}>{role.name}</button>)}<div className="space-y-2 border-t border-border pt-4"><Label>Novo cargo</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Moderador" /><Button className="w-full" variant="outline" disabled={createRole.isPending} onClick={() => createRole.mutate()}><Plus className="mr-2 h-4 w-4" />Criar cargo</Button></div></CardContent></Card><Card className="border-border"><CardHeader><CardTitle>{roles.find((role) => role.key === selectedKey)?.name}</CardTitle><CardDescription>{selectedKey === 'adm_principal' ? 'Este cargo mantém acesso total e não pode ser restringido.' : 'Marque as páginas que estarão visíveis para este cargo.'}</CardDescription></CardHeader><CardContent className="space-y-4">{PAGE_PERMISSIONS.map((page) => <label key={page.key} className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary/40"><span className="text-sm font-medium">{page.label}</span><Checkbox disabled={selectedKey === 'adm_principal'} checked={current.includes(page.key)} onCheckedChange={(checked) => setDraft(current.filter((key) => key !== page.key).concat(checked ? [page.key] : []))} /></label>)}{message && <p className="text-sm text-muted-foreground">{message}</p>}<div className="flex flex-wrap gap-2"><Button disabled={selectedKey === 'adm_principal' || savePermissions.isPending} onClick={() => savePermissions.mutate()}><Save className="mr-2 h-4 w-4" />Salvar permissões</Button>{!DEFAULT_ROLES.some((role) => role.key === selectedKey) && <Button variant="destructive" disabled={removeRole.isPending} onClick={() => removeRole.mutate()}><Trash2 className="mr-2 h-4 w-4" />Excluir cargo</Button>}</div></CardContent></Card></div></div>;
}
