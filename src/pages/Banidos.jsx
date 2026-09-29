import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Search, ShieldBan, Pencil, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const motivoStyles = {
  CHEAT:     'bg-red-500/20 text-red-400 border-red-500/40',
  GROSSEIRO: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  ASSEDIO:   'bg-purple-500/20 text-purple-400 border-purple-500/40',
  TOXICO:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  GOLPE:     'bg-pink-500/20 text-pink-400 border-pink-500/40',
  OUTRO:     'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
};

const initialForm = { nick: '', steamid: '', motivo: 'OUTRO', observacao: '' };

export default function Banidos() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const queryClient = useQueryClient();

  const { data: banidos = [], isLoading } = useQuery({
    queryKey: ['banidos'],
    queryFn: () => base44.entities.Banido.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Banido.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banidos'] });
      setDialogOpen(false);
      setForm(initialForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Banido.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banidos'] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(initialForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Banido.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banidos'] }),
  });

  const openEdit = (b) => {
    setEditingId(b.id);
    setForm({ nick: b.nick || '', steamid: b.steamid || '', motivo: b.motivo || 'OUTRO', observacao: b.observacao || '' });
    setDialogOpen(true);
  };

  const filtered = banidos.filter(b =>
    !search ||
    b.nick?.toLowerCase().includes(search.toLowerCase()) ||
    b.steamid?.includes(search) ||
    b.motivo?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-destructive rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center">
              <ShieldBan className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Lista de Banidos</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{banidos.length} banimentos registrados</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const content = banidos
                .filter(b => b.nick || b.steamid)
                .map(b => `${b.nick || ''} ${b.steamid || ''}`.trim())
                .join('\n');
              const blob = new Blob([content], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'banidos.txt';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Nicks + SteamIDs
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="bg-destructive hover:bg-destructive/90">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Banido
          </Button>
        </div>
      </div>

      {/* Aviso */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-center gap-3">
        <ShieldBan className="w-4 h-4 text-red-400 shrink-0" />
        <p className="text-sm text-red-300">
          Players desta lista estão permanentemente banidos da Glitnir. Não devem ser adicionados à whitelist.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar nick, steamid ou motivo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-secondary border-border"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-red-500/20 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-red-500/5 hover:bg-red-500/5">
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">#</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Nick</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Steam ID</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Motivo</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Observação</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Data</TableHead>
              <TableHead className="w-14"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Nenhum banimento encontrado
                </TableCell>
              </TableRow>
            ) : filtered.map((b, i) => (
              <TableRow key={b.id} className="hover:bg-red-500/5 transition-colors border-l-2 border-red-500/40">
                <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                <TableCell className="font-medium text-foreground">
                  {b.nick || <span className="text-muted-foreground italic">Desconhecido</span>}
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{b.steamid}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={motivoStyles[b.motivo] || motivoStyles.OUTRO}>
                    {b.motivo}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                  {b.observacao || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(b.created_date), 'dd/MM/yyyy')}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(b.id)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(initialForm); } }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <ShieldBan className="w-5 h-5 text-red-400" />
              {editingId ? 'Editar Banido' : 'Adicionar Banido'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nick</Label>
              <Input value={form.nick} onChange={(e) => setForm({ ...form, nick: e.target.value })} className="bg-secondary" placeholder="Ex: xGamer123" />
            </div>
            <div className="space-y-2">
              <Label>Steam ID *</Label>
              <Input value={form.steamid} onChange={(e) => setForm({ ...form, steamid: e.target.value })} className="bg-secondary font-mono" placeholder="76561198..." />
            </div>
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Select value={form.motivo} onValueChange={(v) => setForm({ ...form, motivo: v })}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHEAT">CHEAT</SelectItem>
                  <SelectItem value="GROSSEIRO">GROSSEIRO</SelectItem>
                  <SelectItem value="ASSEDIO">ASSÉDIO</SelectItem>
                  <SelectItem value="TOXICO">TÓXICO</SelectItem>
                  <SelectItem value="GOLPE">GOLPE</SelectItem>
                  <SelectItem value="OUTRO">OUTRO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="bg-secondary" placeholder="Detalhes do banimento..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); setForm(initialForm); }}>Cancelar</Button>
            <Button
              onClick={() => editingId ? updateMutation.mutate({ id: editingId, data: form }) : createMutation.mutate(form)}
              disabled={!form.steamid}
              className="bg-destructive hover:bg-destructive/90"
            >
              {editingId ? 'Salvar' : 'Banir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
