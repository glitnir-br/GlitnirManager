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

async function wardApi(body) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch('/api/server-files', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Falha ao gerenciar wards.');
  return result;
}

const playerName = (player) => player?.personagens?.filter(Boolean)?.join(', ') || player?.nick || 'Sem personagem';

export default function WardsTab() {
  const queryClient = useQueryClient();
  const [server, setServer] = useState('server_1');
  const [steamId, setSteamId] = useState('');
  const [vipSearch, setVipSearch] = useState('');
  const [wardSearch, setWardSearch] = useState('');
  const [message, setMessage] = useState('');
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
  const identifiedWards = useMemo(() => wards.map((ward) => ({ ...ward, player: playerIndex.get(`${server}:${ward.steamId}`) || playerIndex.get(ward.steamId) || null })), [wards, playerIndex, server]);
  const filteredVip = vipPlayers.filter((id) => !vipSearch || id.includes(vipSearch.trim()));
  const filteredWards = identifiedWards.filter(({ steamId: id, player }) => !wardSearch || `${id} ${playerName(player)}`.toLowerCase().includes(wardSearch.trim().toLowerCase())).sort((a, b) => b.wards - a.wards || a.steamId.localeCompare(b.steamId));
  const save = useMutation({ mutationFn: (nextPlayers) => wardApi({ action: 'ward-save-vip', server, players: nextPlayers }), onSuccess: () => { setSteamId(''); setMessage('VIPplayers.txt atualizado com sucesso.'); queryClient.invalidateQueries({ queryKey: ['wards', server] }); }, onError: (error) => setMessage(error.message) });
  const add = () => {
    const value = steamId.trim();
    if (!/^\d{17}$/.test(value)) return setMessage('O Steam ID deve possuir exatamente 17 dígitos.');
    if (vipPlayers.includes(value)) return setMessage('Este Steam ID já está no VIPplayers.txt.');
    if (window.confirm(`Adicionar ${value} ao VIPplayers.txt do ${server === 'server_1' ? 'Server 1' : 'Server 2'}?`)) save.mutate([...vipPlayers, value]);
  };
  const remove = (value) => window.confirm(`Remover ${value} do VIPplayers.txt deste servidor?`) && save.mutate(vipPlayers.filter((item) => item !== value));

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-bold">Wards</h2><p className="text-sm text-muted-foreground">Gerencie VIPplayers.txt e consulte WardData.json separadamente.</p></div><div className="flex gap-2"><Select value={server} onValueChange={(value) => { setServer(value); setMessage(''); }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="server_1">Server 1</SelectItem><SelectItem value="server_2">Server 2</SelectItem></SelectContent></Select><Button variant="outline" disabled={query.isFetching || playersQuery.isFetching} onClick={() => { query.refetch(); playersQuery.refetch(); }}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching || playersQuery.isFetching ? 'animate-spin' : ''}`} />Atualizar</Button></div></div>
    {message && <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{message}</div>}
    {(query.error || playersQuery.error) && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{query.error?.message || playersQuery.error?.message}</div>}
    <div className="grid gap-4 sm:grid-cols-3"><Card><CardHeader className="pb-2"><CardDescription>IDs no VIPplayers</CardDescription><CardTitle>{vipPlayers.length}</CardTitle></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>IDs no WardData</CardDescription><CardTitle>{wards.length}</CardTitle></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>Total de wards</CardDescription><CardTitle>{wards.reduce((total, item) => total + item.wards, 0)}</CardTitle></CardHeader></Card></div>
    <Card><CardHeader><CardTitle>VIPplayers.txt</CardTitle><CardDescription>Lista independente de Steam IDs autorizadas no ArcaneWard deste servidor.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-end"><div className="flex-1"><Label>Steam ID</Label><Input inputMode="numeric" maxLength={17} value={steamId} onChange={(event) => setSteamId(event.target.value.replace(/\D/g, ''))} placeholder="7656119..." /></div><Button disabled={save.isPending || steamId.length !== 17} onClick={add}><Plus className="mr-2 h-4 w-4" />Adicionar</Button></div><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={vipSearch} onChange={(event) => setVipSearch(event.target.value.replace(/\D/g, ''))} placeholder="Buscar na lista VIP..." /></div><div className="space-y-2">{filteredVip.map((id) => <div key={id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><span className="font-mono text-sm">{id}</span><Button size="sm" variant="destructive" disabled={save.isPending} onClick={() => remove(id)}><Trash2 className="mr-1 h-4 w-4" />Remover</Button></div>)}{!filteredVip.length && !query.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum Steam ID no VIPplayers.txt.</p>}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>WardData.json</CardTitle><CardDescription>As wards são associadas aos jogadores salvos no sistema pela Steam ID. Esta lista não altera o VIPplayers.txt.</CardDescription></CardHeader><CardContent><div className="relative mb-4"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={wardSearch} onChange={(event) => setWardSearch(event.target.value)} placeholder="Buscar jogador ou Steam ID..." /></div><div className="space-y-2">{filteredWards.map(({ steamId: id, wards: count, player }) => <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{player ? playerName(player) : 'Jogador não identificado'}</p><p className="font-mono text-xs text-muted-foreground">{id}</p></div><div className="flex items-center gap-2"><Badge variant={player ? 'default' : 'secondary'} className="gap-1">{player ? <UserRoundCheck className="h-3 w-3" /> : <UserRoundX className="h-3 w-3" />}{player ? 'Cadastrado' : 'Não cadastrado'}</Badge><Badge variant="outline">{count} ward{count === 1 ? '' : 's'}</Badge></div></div>)}{!filteredWards.length && !query.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma ward encontrada.</p>}</div></CardContent></Card>
  </div>;
}
