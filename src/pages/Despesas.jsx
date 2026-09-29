import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/dbClient';
import { useAuth } from '@/lib/AuthContext';
import FinancialPasswordProtection from '@/components/FinancialPasswordProtection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Pencil, CheckCircle2, Clock, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import FinanceGuardRole from '@/components/FinanceGuardRole';

const emptyForm = { data: '', descricao: '', valor: '', categoria: '', observacao: '', status_pagamento: 'nao_pago' };

export default function Despesas() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: despesasRaw = [], isLoading } = useQuery({
    queryKey: ['despesas'],
    queryFn: () => base44.entities.Despesa.list(),
  });

  const despesas = [...despesasRaw]
    .filter(d => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        (d.descricao || '').toLowerCase().includes(q) ||
        (d.categoria || '').toLowerCase().includes(q) ||
        (d.observacao || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const da = a.data || a.created_date?.slice(0, 10) || '';
      const db = b.data || b.created_date?.slice(0, 10) || '';
      return db.localeCompare(da);
    });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Despesa.create({ ...data, valor: parseFloat(data.valor) || 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['despesas'] }); setDialogOpen(false); setForm(emptyForm); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Despesa.update(id, { ...data, valor: parseFloat(data.valor) || 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['despesas'] }); setDialogOpen(false); setEditingId(null); setForm(emptyForm); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Despesa.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['despesas'] }),
  });

  const openEdit = (d) => {
    setEditingId(d.id);
    setForm({ data: d.data || '', descricao: d.descricao || '', valor: String(d.valor || ''), categoria: d.categoria || '', observacao: d.observacao || '', status_pagamento: d.status_pagamento || 'nao_pago' });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); };

  const total = despesas.reduce((sum, d) => sum + (d.valor || 0), 0);
  const totalGeral = despesasRaw.reduce((sum, d) => sum + (d.valor || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <FinancialPasswordProtection module="despesas">
      <FinanceGuardRole>
        <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Despesas</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Total: <span className="text-red-400 font-semibold font-mono">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nova Despesa
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, categoria ou observação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Data</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Descrição</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Valor</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Categoria</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Observação</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {despesas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Nenhuma despesa registrada
                  </TableCell>
                </TableRow>
              ) : despesas.map(d => {
                const pago = d.status_pagamento === 'pago';
                return (
                  <TableRow key={d.id} className={pago ? 'bg-green-900/20 hover:bg-green-900/30' : 'hover:bg-secondary/30'}>
                    <TableCell className="text-muted-foreground">{d.data ? format(new Date(d.data + 'T00:00:00'), 'dd/MM/yyyy') : format(new Date(d.created_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium text-foreground">{d.descricao}</TableCell>
                    <TableCell className="font-mono font-semibold text-red-400">R$ {(d.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-muted-foreground">{d.categoria || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{d.observacao || '-'}</TableCell>
                    <TableCell>
                      {pago
                        ? <span className="inline-flex items-center gap-1 text-green-400 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Pago</span>
                        : <span className="inline-flex items-center gap-1 text-yellow-400 text-xs font-semibold"><Clock className="w-3.5 h-3.5" /> Não Pago</span>
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}>
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(d.id)}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingId ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="bg-secondary" />
              </div>
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="bg-secondary" />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="bg-secondary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="bg-secondary" />
                </div>
                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="bg-secondary" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status de Pagamento</Label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status_pagamento: 'pago' })}
                    className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${form.status_pagamento === 'pago' ? 'bg-green-600 border-green-500 text-white' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    ✓ Pago
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status_pagamento: 'nao_pago' })}
                    className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${form.status_pagamento === 'nao_pago' ? 'bg-yellow-600 border-yellow-500 text-white' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    ⏳ Não Pago
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button
                onClick={() => editingId ? updateMutation.mutate({ id: editingId, data: form }) : createMutation.mutate(form)}
                disabled={!form.descricao || !form.valor}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </FinanceGuardRole>
    </FinancialPasswordProtection>
  );
}
