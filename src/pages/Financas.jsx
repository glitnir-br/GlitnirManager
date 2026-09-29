import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import FinancialPasswordProtection from '@/components/FinancialPasswordProtection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, DollarSign, Pencil, Search, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  // Se tem T ou Z, é ISO completo — pega só a parte da data
  const datePart = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
  return format(parseISO(datePart + 'T12:00:00'), 'dd/MM/yyyy');
};
import FinanceGuardRole from '@/components/FinanceGuardRole';

export default function Financas() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterNick, setFilterNick] = useState('');
  const [filterValor, setFilterValor] = useState('');
  const [filterGc, setFilterGc] = useState('');
  const [filterEnviadoPor, setFilterEnviadoPor] = useState('');
  const [filterData, setFilterData] = useState('');
  const [form, setForm] = useState({ data: '', nick: '', valor: '', gc: '', enviado_por: '' });
  const queryClient = useQueryClient();

  const { data: gcTabela = [] } = useQuery({
    queryKey: ['gcTabela'],
    queryFn: () => base44.entities.GcTabela.list('ordem'),
  });

  const gcTabelaDisplay = gcTabela.length > 0
    ? [...gcTabela].sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    : [
        { reais: 15, gc: 4 },
        { reais: 35, gc: 10 },
        { reais: 50, gc: 18 },
        { reais: 100, gc: 40 },
        { reais: 250, gc: 120 },
      ];

  const { data: financasRaw = [], isLoading } = useQuery({
    queryKey: ['financas'],
    queryFn: () => base44.entities.Financa.list(),
  });

  const financas = [...financasRaw].sort((a, b) => {
    const da = a.data || a.created_date?.slice(0, 10) || '';
    const db = b.data || b.created_date?.slice(0, 10) || '';
    return db.localeCompare(da);
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Financa.create({ ...data, valor: parseFloat(data.valor) || 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financas'] });
      setDialogOpen(false);
      setForm({ data: '', nick: '', valor: '', gc: '', enviado_por: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Financa.update(id, { ...data, valor: parseFloat(data.valor) || 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financas'] });
      setDialogOpen(false);
      setEditingId(null);
      setForm({ data: '', nick: '', valor: '', gc: '', enviado_por: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Financa.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financas'] }),
  });

  const openEdit = (f) => {
    setEditingId(f.id);
    setForm({ data: f.data || '', nick: f.nick || '', valor: String(f.valor || ''), gc: f.gc || '', enviado_por: f.enviado_por || '' });
    setDialogOpen(true);
  };

  const total = financas.reduce((sum, f) => sum + (f.valor || 0), 0);

  const availableDates = [...new Set(financas.map(f => f.data || f.created_date?.slice(0, 10) || '').filter(Boolean))].sort((a, b) => b.localeCompare(a));

  const filtered = financas.filter(f => {
    const fDate = f.data || f.created_date?.slice(0, 10) || '';
    return (
      (!filterNick || f.nick?.toLowerCase().includes(filterNick.toLowerCase())) &&
      (!filterValor || String(f.valor || '').includes(filterValor)) &&
      (!filterGc || f.gc?.toLowerCase().includes(filterGc.toLowerCase())) &&
      (!filterEnviadoPor || f.enviado_por?.toLowerCase().includes(filterEnviadoPor.toLowerCase())) &&
      (!filterData || fDate === filterData)
    );
  });

  const hasFilters = filterNick || filterValor || filterGc || filterEnviadoPor || filterData;
  const clearFilters = () => { setFilterNick(''); setFilterValor(''); setFilterGc(''); setFilterEnviadoPor(''); setFilterData(''); };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <FinancialPasswordProtection module="doacoes">
      <FinanceGuardRole>
        <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Doações / GC</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Total: <span className="text-green-400 font-semibold font-mono">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Nova Transação
        </Button>
      </div>

      {/* Tabela de preços GC */}
      <div className="bg-secondary/40 border border-border rounded-xl p-4 max-w-xs">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Tabela de GC</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left pb-2 text-muted-foreground font-medium">Reais (R$)</th>
              <th className="text-right pb-2 text-muted-foreground font-medium">GC</th>
            </tr>
          </thead>
          <tbody>
            {gcTabelaDisplay.map((row) => (
              <tr key={row.reais} className="border-b border-border/50 last:border-0">
                <td className="py-1.5 text-green-400 font-mono font-semibold">R$ {row.reais}</td>
                <td className="py-1.5 text-right text-primary font-mono font-semibold">{row.gc}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
            <label className="text-xs text-muted-foreground">Valor</label>
            <Input placeholder="Ex: 50" value={filterValor} onChange={(e) => setFilterValor(e.target.value)} className="bg-secondary h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">GC</label>
            <Input placeholder="Filtrar GC..." value={filterGc} onChange={(e) => setFilterGc(e.target.value)} className="bg-secondary h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Enviado por</label>
            <Input placeholder="Filtrar..." value={filterEnviadoPor} onChange={(e) => setFilterEnviadoPor(e.target.value)} className="bg-secondary h-8 text-sm" />
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
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Valor</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">GC</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Enviado Por</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhuma transação encontrada
                </TableCell>
              </TableRow>
            ) : filtered.map(f => (
              <TableRow key={f.id} className="hover:bg-secondary/30">
                <TableCell className="text-muted-foreground">{formatDate(f.data || f.created_date)}</TableCell>
                <TableCell className="font-medium text-foreground">{f.nick}</TableCell>
                <TableCell className="font-mono font-semibold text-green-400">R$ {(f.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-muted-foreground">{f.gc || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{f.enviado_por || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(f.id)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm({ data: '', nick: '', valor: '', gc: '', enviado_por: '' }); } }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingId ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Nick *</Label>
              <Input value={form.nick} onChange={(e) => setForm({ ...form, nick: e.target.value })} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="bg-secondary" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>GC</Label>
                <Input value={form.gc} onChange={(e) => setForm({ ...form, gc: e.target.value })} className="bg-secondary" />
              </div>
              <div className="space-y-2">
                <Label>Enviado por</Label>
                <Input value={form.enviado_por} onChange={(e) => setForm({ ...form, enviado_por: e.target.value })} className="bg-secondary" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); setForm({ data: '', nick: '', valor: '', gc: '', enviado_por: '' }); }}>Cancelar</Button>
            <Button
              onClick={() => editingId ? updateMutation.mutate({ id: editingId, data: form }) : createMutation.mutate(form)}
              disabled={!form.nick || !form.valor}
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