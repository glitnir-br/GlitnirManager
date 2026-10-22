import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Search, Trash2, UserRoundCheck, UserRoundX } from 'lucide-react';
import { base44, supabase } from '@/api/dbClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ConfirmationDialog from '@/components/ConfirmationDialog';

async function wardApi(body) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch('/api/server-files', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Falha ao gerenciar wards.');
  return result;
}

const playerName = (player) => player?.personagens?.filter(Boolean)?.join(', ') || player?.nick || 'Sem personagem';
const compareText = (first, second) => String(first).localeCompare(String(second), 'pt-BR', { sensitivity: 'base' });

export default function WardsTab() {
  const queryClient = useQueryClient();
  const [server, setServer] = useState('server_1');
  const [steamId, setSteamId] = useState('');
  const [vipSearch, setVipSearch] = useState('');
  const [wardSearch, setWardSearch] = useState('');
  const [vipSort, setVipSort] = useState('name_asc');
  const [wardSort, setWardSort] = useState('wards_desc');
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const query = useQuery({ queryKey: ['wards', server], queryFn: () => wardApi({ action: 'ward-list', server }) });
  const playersQuery = useQuery({ queryKey: ['ward-player-identities'], queryFn: () => base44.entities.Player.list() });
  const vipPlayers = query.data?.vipPlayers || [];
  const wards = query.data?.wards || [];
  const playerIndex = useMemo(() => {
    const index = new Map();
    for (const player of playersQuery.data || []) {
      const id = String(player.steamid || '').trim();
      if (!id) continue;
      if (player.server === server) index.set(`${server}:${id}`, player);
      if (!index.has(id)) index.set(id, player);
    }
    return index;
  }, [playersQuery.data, server]);
  const identifiedVipPlayers = useMemo(() => vipPlayers.map((id) => ({ id, player: playerIndex.get(`${server}:${id}`) || playerIndex.get(id) || null })), [vipPlayers, playerIndex, server]);
  const identifiedWards = useMemo(() => wards.map((ward) => ({ ...ward, player: playerIndex.get(`${server}:${ward.steamId}`) || playerIndex.get(ward.steamId) || null })), [wards, playerIndex, server]);
  const filteredVip = identifiedVipPlayers.filter(({ id, player }) => !vipSearch || `${id} ${playerName(player)}`.toLowerCase().includes(vipSearch.trim().toLowerCase())).sort((a, b) => vipSort === 'name_desc' ? compareText(playerName(b.player), playerName(a.player)) : vipSort === 'steam_asc' ? compareText(a.id, b.id) : vipSort === 'steam_desc' ? compareText(b.id, a.id) : compareText(playerName(a.player), playerName(b.player)));
  const filteredWards = identifiedWards.filter(({ steamId: id, player }) => !wardSearch || `${id} ${playerName(player)}`.toLowerCase().includes(wardSearch.trim().toLowerCase())).sort((a, b) => wardSort === 'wards_asc' ? a.wards - b.wards || compareText(a.steamId, b.steamId) : wardSort === 'name_asc' ? compareText(playerName(a.player), playerName(b.player)) : wardSort === 'name_desc' ? compareText(playerName(b.player), playerName(a.player)) : wardSort === 'steam_asc' ? compareText(a.steamId, b.steamId) : wardSort === 'steam_desc' ? compareText(b.steamId, a.steamId) : b.wards - a.wards || compareText(a.steamId, b.steamId));
  const save = useMutation({ mutationFn: (nextPlayers) => wardApi({ action: 'ward-save-vip', server, players: nextPlayers }), onSuccess: () => { setSteamId(''); setMessage('VIPplayers.txt atualizado com sucesso.'); queryClient.invalidateQueries({ queryKey: ['wards', server] }); }, onError: (error) => setMessage(error.message) });
  const add = () => {
    const value = steamId.trim();
    if (!/^\d{17}$/.test(value)) return setMessage('O Steam ID deve possuir exatamente 17 dígitos.');
    if (vipPlayers.includes(value)) return setMessage('Este Steam ID já está no VIPplayers.txt.');
    setConfirmation({ title: 'Adicionar jogador VIP?', description: `A Steam ID ${value} será adicionada ao VIPplayers.txt do ${server === 'server_1' ? 'Server 1' : 'Server 2'}.`, confirmLabel: 'Adicionar', onConfirm: () => save.mutate([...vipPlayers, value]) });
  };
  const remove = (value) => setConfirmation({ title: 'Remover jogador VIP?', description: `A Steam ID ${value} será removida do VIPplayers.txt deste servidor.`, confirmLabel: 'Remover', destructive: true, onConfirm: () => save.mutate(vipPlayers.filter((item) => item !== value)) });

  return <div className="min-w-0 space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-bold">Wards</h2><p className="text-sm text-muted-foreground">Gerencie VIPplayers.txt e consulte WardData.json separadamente.</p></div><div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"><Select value={server} onValueChange={(value) => { setServer(value); setMessage(''); }}><SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="server_1">Server 1</SelectItem><SelectItem value="server_2">Server 2</SelectItem></SelectContent></Select><Button variant="outline" disabled={query.isFetching || playersQuery.isFetching} onClick={() => { query.refetch(); playersQuery.refetch(); }}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching || playersQuery.isFetching ? 'animate-spin' : ''}`} />Atualizar</Button></div></div>
    {message && <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{message}</div>}
    {(query.error || playersQuery.error) && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{query.error?.message || playersQuery.error?.message}</div>}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Card className="min-w-0"><CardHeader className="space-y-1 pb-3"><CardDescription className="truncate">IDs no VIPplayers</CardDescription><CardTitle className="text-3xl tabular-nums">{vipPlayers.length}</CardTitle></CardHeader></Card><Card className="min-w-0"><CardHeader className="space-y-1 pb-3"><CardDescription className="truncate">IDs no WardData</CardDescription><CardTitle className="text-3xl tabular-nums">{wards.length}</CardTitle></CardHeader></Card><Card className="min-w-0"><CardHeader className="space-y-1 pb-3"><CardDescription className="truncate">Total de wards</CardDescription><CardTitle className="text-3xl tabular-nums">{wards.reduce((total, item) => total + item.wards, 0)}</CardTitle></CardHeader></Card></div>
    <Card><CardHeader><CardTitle>VIPplayers.txt</CardTitle><CardDescription>Lista independente de Steam IDs autorizadas no ArcaneWard deste servidor, identificadas pelos jogadores cadastrados.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-end"><div className="flex-1"><Label>Steam ID</Label><Input inputMode="numeric" maxLength={17} value={steamId} onChange={(event) => setSteamId(event.target.value.replace(/\D/g, ''))} placeholder="7656119..." /></div><Button className="w-full sm:w-auto" disabled={save.isPending || steamId.length !== 17} onClick={add}><Plus className="mr-2 h-4 w-4" />Adicionar</Button></div><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={vipSearch} onChange={(event) => setVipSearch(event.target.value)} placeholder="Buscar jogador ou Steam ID..." /></div><Select value={vipSort} onValueChange={setVipSort}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name_asc">Nome: A–Z</SelectItem><SelectItem value="name_desc">Nome: Z–A</SelectItem><SelectItem value="steam_asc">Steam ID: crescente</SelectItem><SelectItem value="steam_desc">Steam ID: decrescente</SelectItem></SelectContent></Select></div><div className="space-y-2">{filteredVip.map(({ id, player }) => <div key={id} className="flex min-w-0 flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{player ? playerName(player) : 'Jogador não identificado'}</p><p className="font-mono text-xs text-muted-foreground">{id}</p></div><div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"><Badge variant={player ? 'default' : 'secondary'} className="gap-1">{player ? <UserRoundCheck className="h-3 w-3" /> : <UserRoundX className="h-3 w-3" />}{player ? 'Cadastrado' : 'Não cadastrado'}</Badge><Button size="sm" variant="destructive" disabled={save.isPending} onClick={() => remove(id)}><Trash2 className="mr-1 h-4 w-4" />Remover</Button></div></div>)}{!filteredVip.length && !query.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum Steam ID no VIPplayers.txt.</p>}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>WardData.json</CardTitle><CardDescription>As wards são associadas aos jogadores salvos no sistema pela Steam ID. Esta lista não altera o VIPplayers.txt.</CardDescription></CardHeader><CardContent><div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={wardSearch} onChange={(event) => setWardSearch(event.target.value)} placeholder="Buscar jogador ou Steam ID..." /></div><Select value={wardSort} onValueChange={setWardSort}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="wards_desc">Wards: maior quantidade</SelectItem><SelectItem value="wards_asc">Wards: menor quantidade</SelectItem><SelectItem value="name_asc">Nome: A–Z</SelectItem><SelectItem value="name_desc">Nome: Z–A</SelectItem><SelectItem value="steam_asc">Steam ID: crescente</SelectItem><SelectItem value="steam_desc">Steam ID: decrescente</SelectItem></SelectContent></Select></div><div className="space-y-2">{filteredWards.map(({ steamId: id, wards: count, player }) => <div key={id} className="flex min-w-0 flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{player ? playerName(player) : 'Jogador não identificado'}</p><p className="font-mono text-xs text-muted-foreground">{id}</p></div><div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"><Badge variant={player ? 'default' : 'secondary'} className="gap-1">{player ? <UserRoundCheck className="h-3 w-3" /> : <UserRoundX className="h-3 w-3" />}{player ? 'Cadastrado' : 'Não cadastrado'}</Badge><Badge variant="outline">{count} ward{count === 1 ? '' : 's'}</Badge></div></div>)}{!filteredWards.length && !query.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma ward encontrada.</p>}</div></CardContent></Card>
    <ConfirmationDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />
  </div>;
}
