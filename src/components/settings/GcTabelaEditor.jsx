import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Coins, History, Plus, Trash2 } from 'lucide-react';

import { base44 } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';

// The existing server_1 partition is the canonical storage for this shared configuration.
const GLOBAL_TABLE_SERVER = 'server_1';

export default function GcTabelaEditor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newValues, setNewValues] = useState({ reais: '', gc: '' });
  const { data: table = [], isLoading } = useQuery({ queryKey: ['gcTabela', 'global'], queryFn: () => base44.entities.GcTabela.filter({ server: GLOBAL_TABLE_SERVER }, 'ordem') });
  const { data: logs = [] } = useQuery({ queryKey: ['security-logs', 'gc-table'], queryFn: () => base44.entities.SecurityLog.list('-timestamp', 100) });
  const rows = useMemo(() => [...table].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)), [table]);
  const history = useMemo(() => logs.filter((item) => item.action?.startsWith('gc_table_')).slice(0, 10), [logs]);
  const log = (action, details) => base44.entities.SecurityLog.create({ action, user_email: user.email, performed_by: user.email, details, timestamp: new Date().toISOString() });
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ['gcTabela'] }); queryClient.invalidateQueries({ queryKey: ['security-logs', 'gc-table'] }); };
  const createMutation = useMutation({ mutationFn: async ({ reais, gc }) => { const item = await base44.entities.GcTabela.create({ server: GLOBAL_TABLE_SERVER, reais: Number(reais), gc: Number(gc), ordem: rows.length + 1 }); await log('gc_table_create', `Global: R$ ${reais} = ${gc} Moeda Glitnir`); return item; }, onSuccess: invalidate });
  const updateMutation = useMutation({ mutationFn: async ({ item, field, value }) => { const previous = item[field]; await base44.entities.GcTabela.update(item.id, { [field]: Number(value) || 0 }); await log('gc_table_update', `Global: ${field} alterado de ${previous} para ${value}`); }, onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: async (item) => { await base44.entities.GcTabela.delete(item.id); await log('gc_table_delete', `Global: R$ ${item.reais} = ${item.gc} Moeda Glitnir removido`); }, onSuccess: invalidate });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return <div className="space-y-8">
    <div><div className="mb-1 flex items-center gap-2"><Coins className="h-4 w-4 text-primary" /><h3 className="text-base font-semibold text-foreground">Tabela de Moeda Glitnir</h3></div><p className="text-sm text-muted-foreground">Configuração única, aplicada aos dois servidores.</p></div>
    <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm"><thead><tr className="border-b border-border bg-secondary/50"><th className="px-3 py-2 text-left text-muted-foreground">Valor</th><th className="px-3 py-2 text-left text-muted-foreground">Moeda Glitnir</th><th /></tr></thead><tbody>{!rows.length ? <tr><td colSpan={3} className="px-3 py-5 text-center text-muted-foreground">Nenhum valor cadastrado.</td></tr> : rows.map((item) => <tr key={item.id} className="border-b border-border/50 last:border-0"><td className="p-2"><Input type="number" defaultValue={item.reais} onBlur={(event) => event.target.value !== String(item.reais) && updateMutation.mutate({ item, field: 'reais', value: event.target.value })} className="h-8 bg-secondary font-mono" /></td><td className="p-2"><Input type="number" defaultValue={item.gc} onBlur={(event) => event.target.value !== String(item.gc) && updateMutation.mutate({ item, field: 'gc', value: event.target.value })} className="h-8 bg-secondary font-mono" /></td><td className="p-2"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(item)}><Trash2 className="h-4 w-4 text-red-400" /></Button></td></tr>)}</tbody></table></div>
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2"><Input type="number" value={newValues.reais} onChange={(event) => setNewValues((current) => ({ ...current, reais: event.target.value }))} placeholder="Valor R$" className="bg-secondary" /><Input type="number" value={newValues.gc} onChange={(event) => setNewValues((current) => ({ ...current, gc: event.target.value }))} placeholder="Moeda" className="bg-secondary" /><Button disabled={!newValues.reais || !newValues.gc || createMutation.isPending} onClick={() => { createMutation.mutate(newValues); setNewValues({ reais: '', gc: '' }); }}><Plus className="h-4 w-4" /></Button></div>
    <div className="rounded-xl border border-border bg-secondary/20 p-4"><div className="mb-3 flex items-center gap-2"><History className="h-4 w-4 text-primary" /><h4 className="font-semibold text-foreground">Histórico de alterações</h4></div>{!history.length ? <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p> : <div className="space-y-2">{history.map((item) => <div key={item.id} className="border-b border-border/60 pb-2 text-sm last:border-0"><div className="text-foreground">{item.details}</div><div className="text-xs text-muted-foreground">{item.performed_by} · {item.timestamp ? format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm') : '-'}</div></div>)}</div>}</div>
  </div>;
}
