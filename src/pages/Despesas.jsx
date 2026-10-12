import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isSameMonth, isSameYear, isToday, parseISO } from 'date-fns';
import { CheckCircle2, Clock, Pencil, Plus, Search, Trash2, XCircle } from 'lucide-react';

import { base44 } from '@/api/dbClient';
import FinanceGuardRole from '@/components/FinanceGuardRole';
import FinancialPasswordProtection from '@/components/FinancialPasswordProtection';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const CATEGORIES = [
  'Servidor / hospedagem',
  'Plugins e ferramentas',
  'Publicidade',
  'Premiação',
  'Manutenção',
  'Serviços',
  'Outros',
];

const localToday = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const emptyForm = () => ({ descricao: '', valor: '', categoria: '', categoriaPersonalizada: '', observacao: '', status_pagamento: 'nao_pago' });
const money = (value) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const expenseDate = (expense) => expense.data ? parseISO(expense.data) : new Date(expense.created_date);

export default function Despesas() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [paymentFilter, setPaymentFilter] = useState('todos');
  const [periodFilter, setPeriodFilter] = useState('todos');

  const { data: despesasRaw = [], isLoading } = useQuery({
    queryKey: ['despesas', 'all'],
    queryFn: () => base44.entities.Despesa.list(),
  });

  const despesas = useMemo(() => despesasRaw
    .filter((expense) => {
      const query = search.trim().toLowerCase();
      const date = expenseDate(expense);
      const matchesSearch = !query || [expense.descricao, expense.categoria, expense.observacao]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const matchesCategory = categoryFilter === 'todas' || expense.categoria === categoryFilter;
      const matchesPayment = paymentFilter === 'todos' || expense.status_pagamento === paymentFilter;
      const matchesPeriod = periodFilter === 'todos'
        || (periodFilter === 'hoje' && isToday(date))
        || (periodFilter === 'mes' && isSameMonth(date, new Date()))
        || (periodFilter === 'ano' && isSameYear(date, new Date()));
      return matchesSearch && matchesCategory && matchesPayment && matchesPeriod;
    })
    .sort((a, b) => expenseDate(b) - expenseDate(a)),
  [despesasRaw, search, categoryFilter, paymentFilter, periodFilter]);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const payload = (data) => ({
    descricao: data.descricao.trim(),
    valor: Number(data.valor) || 0,
    categoria: data.categoria === 'Outros' ? data.categoriaPersonalizada.trim() : data.categoria,
    observacao: data.observacao.trim(),
    status_pagamento: data.status_pagamento,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Despesa.create({ ...payload(data), data: localToday(), server: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Despesa.update(id, payload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      closeDialog();
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, paid }) => base44.entities.Despesa.update(id, { status_pagamento: paid ? 'pago' : 'nao_pago' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['despesas'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Despesa.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['despesas'] }),
  });

  const openEdit = (expense) => {
    const isCustomCategory = expense.categoria && !CATEGORIES.includes(expense.categoria);
    setEditingId(expense.id);
    setForm({
      descricao: expense.descricao || '',
      valor: String(expense.valor ?? ''),
      categoria: isCustomCategory ? 'Outros' : expense.categoria || '',
      categoriaPersonalizada: isCustomCategory ? expense.categoria : '',
      observacao: expense.observacao || '',
      status_pagamento: expense.status_pagamento || 'nao_pago',
    });
    setDialogOpen(true);
  };

  const totalFiltered = despesas.reduce((sum, expense) => sum + Number(expense.valor || 0), 0);
  const totalPaid = despesas.filter((expense) => expense.status_pagamento === 'pago').reduce((sum, expense) => sum + Number(expense.valor || 0), 0);
  const totalPending = despesas.filter((expense) => expense.status_pagamento !== 'pago').reduce((sum, expense) => sum + Number(expense.valor || 0), 0);
  const usedCategories = [...new Set(despesasRaw.map((expense) => expense.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const hasFilters = search || categoryFilter !== 'todas' || paymentFilter !== 'todos' || periodFilter !== 'todos';
  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('todas');
    setPaymentFilter('todos');
    setPeriodFilter('todos');
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>;
  }

  return (
    <FinancialPasswordProtection module="despesas">
      <FinanceGuardRole>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Despesas</h1>
              <p className="mt-1 text-sm text-muted-foreground">Controle de pagamentos e custos do servidor</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="bg-red-600 text-white hover:bg-red-700"><Plus className="mr-2 h-4 w-4" />Nova despesa</Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard title="Total pago" value={money(totalPaid)} icon={CheckCircle2} color="text-green-400" />
            <SummaryCard title="Total pendente" value={money(totalPending)} icon={Clock} color="text-yellow-400" />
            <SummaryCard title="Total filtrado" value={money(totalFiltered)} icon={XCircle} color="text-red-400" />
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros</span>{hasFilters && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>Limpar</Button>}</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Descrição ou observação..." value={search} onChange={(event) => setSearch(event.target.value)} className="bg-secondary pl-9" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-secondary"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent><SelectItem value="todas">Todas as categorias</SelectItem>{usedCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todos os pagamentos</SelectItem><SelectItem value="pago">Pago</SelectItem><SelectItem value="nao_pago">Não pago</SelectItem></SelectContent>
              </Select>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todo o período</SelectItem><SelectItem value="hoje">Hoje</SelectItem><SelectItem value="mes">Mês atual</SelectItem><SelectItem value="ano">Ano atual</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader><TableRow className="bg-secondary/50 hover:bg-secondary/50"><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Categoria</TableHead><TableHead>Observações</TableHead><TableHead>Pagamento</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
              <TableBody>
                {!despesas.length ? <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">Nenhuma despesa encontrada</TableCell></TableRow> : despesas.map((expense) => {
                  const paid = expense.status_pagamento === 'pago';
                  return <TableRow key={expense.id} className={paid ? 'bg-green-900/20 hover:bg-green-900/30' : 'hover:bg-secondary/30'}>
                    <TableCell className="text-muted-foreground">{format(expenseDate(expense), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium text-foreground">{expense.descricao}</TableCell>
                    <TableCell className="font-mono font-semibold text-red-400">{money(expense.valor)}</TableCell>
                    <TableCell className="text-muted-foreground">{expense.categoria || '-'}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">{expense.observacao || '-'}</TableCell>
                    <TableCell><Button type="button" size="sm" variant={paid ? 'default' : 'outline'} disabled={paymentMutation.isPending} onClick={() => paymentMutation.mutate({ id: expense.id, paid: !paid })} className={`min-w-27 gap-2 ${paid ? 'bg-green-600 hover:bg-green-700' : ''}`}>{paid ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}{paid ? 'Pago' : 'Não pago'}</Button></TableCell>
                    <TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(expense)}><Pencil className="h-4 w-4 text-muted-foreground" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(expense.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button></div></TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
            <DialogContent className="max-w-md border-border bg-card">
              <DialogHeader><DialogTitle>{editingId ? 'Editar despesa' : 'Nova despesa'}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                {!editingId && <p className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">A data de hoje será registrada automaticamente ao salvar.</p>}
                <div className="space-y-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} className="bg-secondary" /></div>
                <div className="space-y-2"><Label>Valor (R$) *</Label><Input type="number" min="0" step="0.01" value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} className="bg-secondary" /></div>
                <div className="space-y-2"><Label>Categoria *</Label><Select value={form.categoria} onValueChange={(categoria) => setForm({ ...form, categoria, categoriaPersonalizada: categoria === 'Outros' ? form.categoriaPersonalizada : '' })}><SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
                {form.categoria === 'Outros' && <div className="space-y-2"><Label>Categoria personalizada *</Label><Input value={form.categoriaPersonalizada} onChange={(event) => setForm({ ...form, categoriaPersonalizada: event.target.value })} className="bg-secondary" placeholder="Ex: Transporte" /></div>}
                <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacao} onChange={(event) => setForm({ ...form, observacao: event.target.value })} className="bg-secondary" placeholder="Fornecedor, comprovante ou referência..." rows={3} /></div>
                <div className="space-y-2"><Label>Status de pagamento</Label><div className="flex gap-3"><Button type="button" variant={form.status_pagamento === 'pago' ? 'default' : 'outline'} className={`flex-1 ${form.status_pagamento === 'pago' ? 'bg-green-600 hover:bg-green-700' : ''}`} onClick={() => setForm({ ...form, status_pagamento: 'pago' })}><CheckCircle2 className="mr-2 h-4 w-4" />Pago</Button><Button type="button" variant={form.status_pagamento === 'nao_pago' ? 'default' : 'outline'} className={`flex-1 ${form.status_pagamento === 'nao_pago' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`} onClick={() => setForm({ ...form, status_pagamento: 'nao_pago' })}><Clock className="mr-2 h-4 w-4" />Não pago</Button></div></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={closeDialog}>Cancelar</Button><Button onClick={() => editingId ? updateMutation.mutate({ id: editingId, data: form }) : createMutation.mutate(form)} disabled={!form.descricao.trim() || !form.valor || !form.categoria || (form.categoria === 'Outros' && !form.categoriaPersonalizada.trim()) || createMutation.isPending || updateMutation.isPending} className="bg-red-600 text-white hover:bg-red-700">Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </FinanceGuardRole>
    </FinancialPasswordProtection>
  );
}

function SummaryCard({ title, value, icon: Icon, color }) {
  return <div className="rounded-xl border border-border bg-card p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p><p className={`mt-2 font-mono text-2xl font-bold ${color}`}>{value}</p></div><Icon className={`h-5 w-5 ${color}`} /></div></div>;
}
