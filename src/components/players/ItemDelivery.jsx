import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, PackageSearch, Search } from 'lucide-react';
import { supabase } from '@/api/dbClient';
import vanillaCatalog from '@/data/valheim-item-catalog.json';
import customCatalog from '@/data/verified-custom-item-catalog.json';
import { isPlayerInventoryItem, itemDisplayName, shouldShowPrefab } from '@/lib/itemNames';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CATALOG = [...new Map([...Object.values(vanillaCatalog), ...Object.values(customCatalog)].filter(isPlayerInventoryItem).map((item) => [item.prefab, item])).values()].sort((a, b) => itemDisplayName(a).localeCompare(itemDisplayName(b), 'pt-BR'));
const STATUS = { em_processamento: 'Em processamento', entregue: 'Entregue', falhou: 'Falhou', resultado_incerto: 'Resultado incerto' };
const playerName = (player) => player?.personagens?.filter(Boolean)?.join(', ') || player?.nick || 'Sem nome';

async function itemApi(body) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch('/api/item-deliveries', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Falha ao gerenciar envio de item.');
  return result;
}

export function ItemDeliveryDialog({ open, onOpenChange, player, server, onComplete }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(''); const [selected, setSelected] = useState(null); const [quantity, setQuantity] = useState('1'); const [quality, setQuality] = useState(''); const [error, setError] = useState(''); const [operationKey, setOperationKey] = useState('');
  const matches = useMemo(() => search.trim().length > 1 ? CATALOG.filter((item) => `${itemDisplayName(item)} ${item.prefab} ${item.token || ''}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 30) : [], [search]);
  const send = useMutation({ mutationFn: () => itemApi({ action: 'send', operationKey, playerId: player.id, steamid: player.steamid, server, prefab: selected.prefab, quantity: Number(quantity), quality: quality.trim() || null }), onMutate: () => setError(''), onSuccess: (result) => { onComplete?.(result.delivery); onOpenChange(false); }, onError: (mutationError) => { setError(mutationError.message); setOperationKey(crypto.randomUUID()); }, onSettled: () => queryClient.invalidateQueries({ queryKey: ['item-deliveries', server] }) });
  useEffect(() => { if (!open || !player?.steamid) return; setSearch(''); setSelected(null); setQuantity('1'); setQuality(''); setError(''); setOperationKey(crypto.randomUUID()); }, [open, player?.steamid, server]);
  const close = () => { if (!send.isPending) onOpenChange(false); };
  const qualityIsValid = quality.trim() === '' || (Number.isInteger(Number(quality)) && Number(quality) >= 1 && (!selected?.maxQuality || Number(quality) <= selected.maxQuality));
  return <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Enviar item individual</DialogTitle></DialogHeader>{player && <div className="space-y-4"><div className="rounded-lg border border-border bg-secondary/30 p-3"><p className="font-semibold">{playerName(player)}</p><p className="text-xs text-muted-foreground">Steam ID {player.steamid} · {server === 'server_1' ? 'Server 1' : 'Server 2'}</p></div><div><Label>Item</Label>{selected && <div className="mb-2 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 p-3"><div><p className="font-medium">{itemDisplayName(selected)}</p><p className="text-xs text-muted-foreground">{selected.prefab}</p></div><Button size="sm" variant="outline" onClick={() => setSelected(null)}>Trocar</Button></div>}<div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setSelected(null); }} placeholder="Buscar por nome ou prefab..." /></div>{matches.length > 0 && !selected && <div className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-popover p-1">{matches.map((item) => { const name = itemDisplayName(item); return <button key={item.prefab} type="button" onClick={() => { setSelected(item); setSearch(''); setQuality(''); }} className="block w-full rounded p-2 text-left text-sm hover:bg-secondary"><span className="font-medium">{name}</span>{shouldShowPrefab(name, item.prefab) && <span className="ml-2 text-xs text-muted-foreground">{item.prefab}</span>}</button>; })}</div>}</div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Quantidade</Label><Input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div><div><Label>Qualidade (opcional)</Label><Input type="number" min="1" max={selected?.maxQuality || undefined} value={quality} onChange={(event) => setQuality(event.target.value)} placeholder="Padrão do item" /></div></div>{selected && <div className="rounded-lg border border-border p-3 text-sm"><strong>Comando:</strong> <code className="break-all">mpmail send {player.steamid} {selected.prefab} {quantity || 0}{quality.trim() ? ` ${quality}` : ''}</code></div>}{error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><strong>Envio não concluído.</strong> {error.replace(/^Envio não concluído:\s*/i, '')}</div>}</div>}<DialogFooter><Button variant="outline" disabled={send.isPending} onClick={close}>Cancelar</Button><Button disabled={send.isPending || !selected || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || !qualityIsValid} onClick={() => send.mutate()}>{send.isPending ? 'Enviando...' : 'Confirmar envio'}</Button></DialogFooter></DialogContent></Dialog>;
}

export function ItemDeliveryHistory({ server }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['item-deliveries', server], queryFn: () => itemApi({ action: 'list', server }) });
  const rows = data?.deliveries || [];
  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Carregando histórico...</div>;
  if (error) return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error.message}</div>;
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><PackageSearch className="h-5 w-5 text-primary" />Histórico de envios individuais</CardTitle><CardDescription>Comandos de entrega executados no {server === 'server_1' ? 'Server 1' : 'Server 2'}.</CardDescription></CardHeader><CardContent><div className="space-y-3">{rows.map((item) => <div key={item.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{item.character_name} · {item.steamid}</p><p className="text-sm text-muted-foreground">{item.quantity}× {item.friendly_name} · {item.quality == null ? 'qualidade padrão' : `qualidade ${item.quality}`}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('pt-BR')} · {item.created_by}</p></div><Badge variant={item.status === 'entregue' ? 'default' : item.status === 'falhou' || item.status === 'resultado_incerto' ? 'destructive' : 'secondary'}>{STATUS[item.status] || item.status}</Badge></div>{(item.response || item.error) && <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Resposta técnica</summary><code className="mt-2 block whitespace-pre-wrap break-all rounded bg-secondary/50 p-2">{item.response || item.error}</code></details>}</div>)}{!rows.length && <div className="py-10 text-center text-sm text-muted-foreground"><Clock3 className="mx-auto mb-2 h-5 w-5" />Nenhum item individual enviado neste servidor.</div>}</div></CardContent></Card>;
}
