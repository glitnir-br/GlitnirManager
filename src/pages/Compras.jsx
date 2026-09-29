import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/dbClient';
import { useAuth } from '@/lib/AuthContext';
import FinancialPasswordProtection from '@/components/FinancialPasswordProtection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Pencil, Search, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const datePart = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
  return format(parseISO(datePart + 'T12:00:00'), 'dd/MM/yyyy');
};
import FinanceGuardRole from '@/components/FinanceGuardRole';

export default function Compras() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ data: '', nick: '', produto: '', valor: '', guilda: '' });
  const [filterNick, setFilterNick] = useState('');
  const [filterProduto, setFilterProduto] = useState('');
  const [filterValor, setFilterValor] = useState('');
  const [filterGuilda, setFilterGuilda] = useState('');
  const [filterData, setFilterData] = useState('');
  const queryClient = useQueryClient();

  const { data: comprasRaw = [], isLoading } = useQuery({
    queryKey: ['compras'],
    queryFn: () => base44.entities.Compra.list(),
  });

  const compras = [...comprasRaw].sort((a, b) => {
    const da = a.data || a.created_date?.slice(0, 10) || '';
    const db = b.data || b.created_date?.slice(0, 10) || '';
    return db.localeCompare(da);
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Compra.create({ ...data, valor: parseFloat(data.valor) || 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras'] });
      setDialogOpen(false);
      setForm({ data: '', nick: '', produto: '', valor: '', guilda: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Compra.update(id, { ...data, valor: parseFloat(data.valor) || 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras'] });
      setDialogOpen(false);
      setEditingId(null);
      setForm({ data: '', nick: '', produto: '', valor: '', guilda: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Compra.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compras'] }),
  });

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({ data: c.data || '', nick: c.nick || '', produto: c.produto || '', valor: String(c.valor || ''), guilda: c.guilda || '' });
    setDialogOpen(true);
  };

  const availableDates = [...new Set(compras.map(c => c.data || c.created_date?.slice(0, 10) || '').filter(Boolean))].sort((a, b) => b.localeCompare(a));

  const filtered = compras.filter(c => {
    const cDate = c.data || c.created_date?.slice(0, 10) || '';
    return (
      (!filterNick || c.nick?.toLowerCase().includes(filterNick.toLowerCase())) &&
      (!filterProduto || c.produto?.toLowerCase().includes(filterProduto.toLowerCase())) &&
      (!filterValor || String(c.valor || '').includes(filterValor)) &&
      (!filterGuilda || c.guilda?.toLowerCase().includes(filterGuilda.toLowerCase())) &&
      (!filterData || cDate === filterData)
    );
  });

  const hasFilters = filterNick || filterProduto || filterValor || filterGuilda || filterData;
  const clearFilters = () => { setFilterNick(''); setFilterProduto(''); setFilterValor(''); setFilterGuilda(''); setFilterData(''); };

  const total = compras.reduce((sum, c) => sum + (c.valor || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <FinancialPasswordProtection module="compras">
      <FinanceGuardRole>
        <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Pacotes Guildas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Total: <span className="text-accent font-semibold font-mono">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Nova Compra
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Search className="w-3.5 h-3.5" /> Filtros</span>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground text-xs h-7 gap-1">
              <X className="w-3 h-3" /> Limpar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nick</label>
            <Input placeholder="Filtrar nick..." value={filterNick} onChange={(e) => setFilterNick(e.target.value)} className="bg-secondary h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Produto</label>
            <Input placeholder="Filtrar produto..." value={filterProduto} onChange={(e) => setFilterProduto(e.target.value)} className="bg-secondary h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Valor</label>
            <Input placeholder="Ex: 50" value={filterValor} onChange={(e) => setFilterValor(e.target.value)} className="bg-secondary h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Guilda</label>
            <Input placeholder="Filtrar guilda..." value={filterGuilda} onChange={(e) => setFilterGuilda(e.target.value)} className="bg-secondary h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Data</label>
            <Select value={filterData || 'todas'} onValueChange={(v) => setFilterData(v === 'todas' ? '' : v)}>
              <SelectTrigger className="bg-secondary h-8 text-sm">
                <SelectValue placeholder="Todas as datas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as datas</SelectItem>
                {availableDates.map(d => (
                  <SelectItem key={d} value={d}>{formatDate(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Data</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Nick</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Produto</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Valor</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Guilda</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhuma compra encontrada
                </TableCell>
              </TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id} className="hover:bg-secondary/30">
                <TableCell className="text-muted-foreground">{formatDate(c.data || c.created_date)}</TableCell>
                <TableCell className="font-medium text-foreground">{c.nick}</TableCell>
                <TableCell className="text-foreground">{c.produto}</TableCell>
                <TableCell className="font-mono font-semibold text-accent">R$ {(c.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-muted-foreground">{c.guilda || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(c.id)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm({ data: '', nick: '', produto: '', valor: '', guilda: '' }); } }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingId ? 'Editar Pacote Guilda' : 'Nova Compra'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="bg-secondary" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nick *</Label>
                <Input value={form.nick} onChange={(e) => setForm({ ...form, nick: e.target.value })} className="bg-secondary" />
              </div>
              <div className="space-y-2">
                <Label>Guilda</Label>
                <Input value={form.guilda} onChange={(e) => setForm({ ...form, guilda: e.target.value })} className="bg-secondary" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Produto *</Label>
              <Input value={form.produto} onChange={(e) => setForm({ ...form, produto: e.target.value })} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="bg-secondary" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); setForm({ data: '', nick: '', produto: '', valor: '', guilda: '' }); }}>Cancelar</Button>
            <Button
              onClick={() => editingId ? updateMutation.mutate({ id: editingId, data: form }) : createMutation.mutate(form)}
              disabled={!form.nick || !form.produto || !form.valor}
              className="bg-primary hover:bg-primary/90"
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
