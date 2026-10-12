import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isSameMonth, isSameYear, isToday, parseISO, subDays } from 'date-fns';
import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Clock3,
  DollarSign,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { base44 } from '@/api/dbClient';
import FinanceGuardRole from '@/components/FinanceGuardRole';
import FinancialPasswordProtection from '@/components/FinancialPasswordProtection';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const localDateTimeNow = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const emptyForm = () => ({
  data: localDateTimeNow(),
  player_id: '',
  steamid: '',
  personagem: '',
  valor: '',
  gc: '',
  valorOption: '',
  server: '',
});

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? parseISO(`${dateStr}T12:00:00`)
    : parseISO(dateStr);
  return format(parsed, 'dd/MM/yyyy HH:mm');
};

const toDateTimeLocal = (dateStr) => {
  if (!dateStr) return localDateTimeNow();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? parseISO(`${dateStr}T12:00:00`)
    : parseISO(dateStr);
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const playerCharacters = (player) => {
  if (Array.isArray(player?.personagens) && player.personagens.length) return player.personagens.filter(Boolean);
  return player?.nick ? [player.nick] : [];
};

const playerName = (player) => playerCharacters(player).join(', ') || 'Sem personagem';

export default function Financas() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [playerPickerOpen, setPlayerPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterPlayer, setFilterPlayer] = useState('');
  const [filterValor, setFilterValor] = useState('');
  const [filterGc, setFilterGc] = useState('');
  const [filterEnvio, setFilterEnvio] = useState('todos');
  const [filterData, setFilterData] = useState('todos');

  const { data: gcTabela = [] } = useQuery({
    queryKey: ['gcTabela', 'global'],
    queryFn: () => base44.entities.GcTabela.filter({ server: 'server_1' }, 'ordem'),
  });

  const gcTabelaDisplay = gcTabela.length
    ? [...gcTabela].sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    : [
        { reais: 15, gc: 4 },
        { reais: 35, gc: 10 },
        { reais: 50, gc: 18 },
        { reais: 100, gc: 40 },
        { reais: 250, gc: 120 },
      ];

  const { data: players = [], isLoading: playersLoading } = useQuery({
    queryKey: ['players', 'whitelist', 'all'],
    queryFn: async () => (await base44.entities.Player.filter({ na_whitelist: true })).filter((player) => player.server === 'server_1' || player.server === 'server_2'),
  });

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => playerName(a).localeCompare(playerName(b), 'pt-BR')),
    [players],
  );

  const { data: financasRaw = [], isLoading: financesLoading } = useQuery({
    queryKey: ['financas', 'all'],
    queryFn: () => base44.entities.Financa.list(),
  });

  const financas = useMemo(
    () => [...financasRaw].sort((a, b) => {
      const dateA = a.data || a.created_date?.slice(0, 10) || '';
      const dateB = b.data || b.created_date?.slice(0, 10) || '';
      return dateB.localeCompare(dateA);
    }),
    [financasRaw],
  );

  const closeDialog = () => {
    setDialogOpen(false);
    setPlayerPickerOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const donationPayload = ({ valorOption: _valorOption, ...data }) => ({
    ...data,
    data: data.data ? new Date(data.data).toISOString() : new Date().toISOString(),
    nick: data.personagem,
    valor: Number(data.valor) || 0,
    gc: String(data.gc ?? ''),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Financa.create({
      ...donationPayload(data),
      data: new Date().toISOString(),
      server: data.server || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financas'] });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Financa.update(id, donationPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financas'] });
      closeDialog();
    },
  });

  const deliveryMutation = useMutation({
    mutationFn: ({ id, sent }) =>
      base44.entities.Financa.update(id, {
        moeda_enviada: sent,
        moeda_enviada_at: sent ? new Date().toISOString() : null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financas'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Financa.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financas'] }),
  });

  const selectPlayer = (player) => {
    setForm((current) => ({
      ...current,
      player_id: player.id,
      steamid: player.steamid || '',
      personagem: playerName(player) === 'Sem personagem' ? '' : playerName(player),
    }));
    setPlayerPickerOpen(false);
  };

  const selectValue = (value) => {
    if (value === 'custom') {
      setForm((current) => ({ ...current, valorOption: 'custom', valor: '', gc: '' }));
      return;
    }
    const row = gcTabelaDisplay.find((item, index) => String(item.id || index) === value);
    if (row) {
      setForm((current) => ({
        ...current,
        valorOption: value,
        valor: String(row.reais),
        gc: String(row.gc),
      }));
    }
  };

  const openEdit = (finance) => {
    const matchingOptionIndex = gcTabelaDisplay.findIndex(
      (row) => Number(row.reais) === Number(finance.valor) && Number(row.gc) === Number(finance.gc),
    );
    const matchingPlayer = players.find(
      (player) => player.id === finance.player_id || (finance.steamid && player.steamid === finance.steamid),
    );
    setEditingId(finance.id);
    setForm({
      data: toDateTimeLocal(finance.data || finance.created_date),
      player_id: matchingPlayer?.id || finance.player_id || '',
      steamid: matchingPlayer?.steamid || finance.steamid || '',
      personagem: matchingPlayer
        ? (playerName(matchingPlayer) === 'Sem personagem' ? '' : playerName(matchingPlayer))
        : finance.personagem || finance.nick || '',
      valor: String(finance.valor ?? ''),
      gc: String(finance.gc ?? ''),
      server: finance.server || '',
      valorOption:
        matchingOptionIndex >= 0
          ? String(gcTabelaDisplay[matchingOptionIndex].id || matchingOptionIndex)
          : 'custom',
    });
    setDialogOpen(true);
  };

  const total = financas.reduce((sum, finance) => sum + Number(finance.valor || 0), 0);
  const filtered = financas.filter((finance) => {
    const date = parseISO(finance.data || finance.created_date || new Date().toISOString());
    const identity = `${finance.personagem || finance.nick || ''} ${finance.steamid || ''}`.toLowerCase();
    const matchesPeriod = filterData === 'todos'
      || (filterData === 'hoje' && isToday(date))
      || (filterData === '7_dias' && date >= subDays(new Date(), 7))
      || (filterData === '30_dias' && date >= subDays(new Date(), 30))
      || (filterData === 'mes_atual' && isSameMonth(date, new Date()))
      || (filterData === 'mes_anterior' && isSameMonth(date, subDays(new Date(), new Date().getDate())))
      || (filterData === 'ano_atual' && isSameYear(date, new Date()));
    return (
      (!filterPlayer || identity.includes(filterPlayer.toLowerCase())) &&
      (!filterValor || String(finance.valor || '').includes(filterValor)) &&
      (!filterGc || String(finance.gc || '').toLowerCase().includes(filterGc.toLowerCase())) &&
      (filterEnvio === 'todos' || (filterEnvio === 'enviado' ? finance.moeda_enviada : !finance.moeda_enviada)) &&
      matchesPeriod
    );
  });

  const hasFilters = filterPlayer || filterValor || filterGc || filterEnvio !== 'todos' || filterData !== 'todos';
  const clearFilters = () => {
    setFilterPlayer('');
    setFilterValor('');
    setFilterGc('');
    setFilterEnvio('todos');
    setFilterData('todos');
  };

  if (playersLoading || financesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <FinancialPasswordProtection module="doacoes">
      <FinanceGuardRole>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Doações</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Total:{' '}
                <span className="font-mono font-semibold text-green-400">R$ {formatMoney(total)}</span>
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Nova doação
            </Button>
          </div>

          <div className="max-w-xs rounded-xl border border-border bg-secondary/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Tabela de Moeda Glitnir</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-medium text-muted-foreground">Valor</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Moeda Glitnir</th>
                </tr>
              </thead>
              <tbody>
                {gcTabelaDisplay.map((row, index) => (
                  <tr key={row.id || index} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 font-mono font-semibold text-green-400">R$ {formatMoney(row.reais)}</td>
                    <td className="py-1.5 text-right font-mono font-semibold text-primary">{row.gc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Search className="h-3.5 w-3.5" /> Filtros
              </span>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 gap-1 text-xs text-muted-foreground">
                  <X className="h-3 w-3" /> Limpar
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Personagem ou Steam ID</Label>
                <Input placeholder="Buscar player..." value={filterPlayer} onChange={(event) => setFilterPlayer(event.target.value)} className="h-8 bg-secondary text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor</Label>
                <Input placeholder="Ex: 50" value={filterValor} onChange={(event) => setFilterValor(event.target.value)} className="h-8 bg-secondary text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Moeda Glitnir</Label>
                <Input placeholder="Ex: 18" value={filterGc} onChange={(event) => setFilterGc(event.target.value)} className="h-8 bg-secondary text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Envio</Label>
                <Select value={filterEnvio} onValueChange={setFilterEnvio}>
                  <SelectTrigger className="h-8 bg-secondary text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="pendente">Não enviado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data</Label>
                <Select value={filterData} onValueChange={setFilterData}>
                  <SelectTrigger className="h-8 bg-secondary text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todo o período</SelectItem>
                    <SelectItem value="hoje">Último dia</SelectItem>
                    <SelectItem value="7_dias">Últimos 7 dias</SelectItem>
                    <SelectItem value="30_dias">Últimos 30 dias</SelectItem>
                    <SelectItem value="mes_atual">Mês atual</SelectItem>
                    <SelectItem value="mes_anterior">Último mês</SelectItem>
                    <SelectItem value="ano_atual">Ano atual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead>Data</TableHead>
                  <TableHead>Personagem</TableHead>
                  <TableHead>Steam ID</TableHead>
                  <TableHead>Servidor</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Moeda Glitnir</TableHead>
                  <TableHead>Envio</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filtered.length ? (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">Nenhuma doação encontrada</TableCell></TableRow>
                ) : filtered.map((finance) => (
                  <TableRow key={finance.id} className="hover:bg-secondary/30">
                    <TableCell className="text-muted-foreground">{formatDate(finance.data || finance.created_date)}</TableCell>
                    <TableCell className="font-medium text-foreground">{finance.personagem || finance.nick || '-'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{finance.steamid || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{finance.server === 'server_1' ? 'Server 1' : finance.server === 'server_2' ? 'Server 2' : '-'}</TableCell>
                    <TableCell className="font-mono font-semibold text-green-400">R$ {formatMoney(finance.valor)}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{finance.gc || '-'}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant={finance.moeda_enviada ? 'default' : 'outline'}
                        className={cn('min-w-28 gap-2', finance.moeda_enviada && 'bg-green-600 hover:bg-green-700')}
                        disabled={deliveryMutation.isPending}
                        onClick={() => deliveryMutation.mutate({ id: finance.id, sent: !finance.moeda_enviada })}
                      >
                        {finance.moeda_enviada ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                        {finance.moeda_enviada ? 'Enviado' : 'Não enviado'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(finance)}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(finance.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
            <DialogContent className="max-w-md border-border bg-card">
              <DialogHeader><DialogTitle>{editingId ? 'Editar doação' : 'Nova doação'}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Personagem ou Steam ID *</Label>
                  <Popover open={playerPickerOpen} onOpenChange={setPlayerPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="h-auto min-h-10 w-full justify-between bg-secondary text-left font-normal">
                        <span className={cn('min-w-0 truncate', !form.player_id && 'text-muted-foreground')}>
                          {form.player_id ? `${form.personagem || 'Sem personagem'} — ${form.steamid}` : 'Buscar por personagem ou Steam ID'}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput autoFocus placeholder="Digite para buscar personagem ou Steam ID..." />
                        <CommandList>
                          <CommandEmpty>Nenhum player encontrado na whitelist.</CommandEmpty>
                          <CommandGroup>
                            {sortedPlayers.map((player) => (
                              <CommandItem
                                key={player.id}
                                value={`${playerName(player)} ${player.steamid || ''}`}
                                onSelect={() => selectPlayer(player)}
                              >
                                <Check className={cn('h-4 w-4', form.player_id === player.id ? 'opacity-100' : 'opacity-0')} />
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{playerName(player)}</div>
                                  <div className="truncate font-mono text-xs text-muted-foreground">{player.steamid}</div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Servidor <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                  <Select value={form.server || 'nao_informado'} onValueChange={(value) => setForm((current) => ({ ...current, server: value === 'nao_informado' ? '' : value }))}>
                    <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="nao_informado">Não informado</SelectItem><SelectItem value="server_1">Server 1</SelectItem><SelectItem value="server_2">Server 2</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor e Moeda Glitnir *</Label>
                  <Select value={form.valorOption} onValueChange={selectValue}>
                    <SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecione um valor" /></SelectTrigger>
                    <SelectContent>
                      {gcTabelaDisplay.map((row, index) => (
                        <SelectItem key={row.id || index} value={String(row.id || index)}>
                          R$ {formatMoney(row.reais)} — {row.gc} Moeda Glitnir
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Valor personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.valorOption === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor (R$) *</Label>
                      <Input type="number" min="0" step="0.01" value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} className="bg-secondary" />
                    </div>
                    <div className="space-y-2">
                      <Label>Moeda Glitnir *</Label>
                      <Input type="number" min="0" step="1" value={form.gc} onChange={(event) => setForm({ ...form, gc: event.target.value })} className="bg-secondary" />
                    </div>
                  </div>
                )}
                {form.valorOption && form.valorOption !== 'custom' && (
                  <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                    <div><span className="text-muted-foreground">Valor</span><div className="font-mono font-semibold text-green-400">R$ {formatMoney(form.valor)}</div></div>
                    <div><span className="text-muted-foreground">Moeda Glitnir</span><div className="font-mono font-semibold text-primary">{form.gc}</div></div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button
                  onClick={() => editingId ? updateMutation.mutate({ id: editingId, data: form }) : createMutation.mutate(form)}
                  disabled={!form.player_id || !form.valor || !form.gc || createMutation.isPending || updateMutation.isPending}
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
