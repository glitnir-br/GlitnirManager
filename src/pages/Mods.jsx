import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/api/dbClient';
import { useAuth } from '@/lib/AuthContext';
import { compareMods, MOD_SERVERS, MOD_SOURCES } from '@/lib/modComparison';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

async function request(body) {
  if (!supabase) throw new Error('A consulta exige conexão com o Supabase.');
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Sessão expirada. Entre novamente.');
  const response = await fetch('/api/mod-comparison', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Falha ao consultar mods.');
  return result;
}

function VersionCell({ entry }) {
  if (!entry) return <span className="text-muted-foreground">Ausente</span>;
  if (entry.status === 'missing') return <span className="text-amber-500">Sem manifest</span>;
  if (entry.status === 'invalid') return <span className="text-amber-500">Manifest inválido</span>;
  if (entry.status === 'incomplete') return <span className="text-amber-500">Busca limitada</span>;
  if (entry.status === 'file') return <span className="text-amber-500">Arquivo sem manifest</span>;
  return <span className="font-mono text-foreground">{entry.version}</span>;
}

export default function Mods() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const snapshotQuery = useQuery({ queryKey: ['mod-comparison'], queryFn: () => request({ action: 'get' }), refetchOnWindowFocus: true, retry: false, refetchInterval: (query) => query.state.data?.job?.status === 'running' ? 4000 : false });
  const snapshot = snapshotQuery.data?.snapshot;
  const job = snapshotQuery.data?.job;
  const running = job?.status === 'running';
  const resumable = job?.status === 'paused' || job?.status === 'failed';
  const canManage = !job?.owner || job.owner === user?.email || user?.role === 'adm_principal';
  const action = useMutation({ mutationFn: (value) => request({ action: value }), onSettled: () => queryClient.invalidateQueries({ queryKey: ['mod-comparison'] }) });
  const rows = useMemo(() => compareMods(snapshot?.entries || []).filter((row) => (!onlyDifferences || row.divergent) && `${row.name} ${row.folder}`.toLowerCase().includes(search.trim().toLowerCase())), [snapshot, onlyDifferences, search]);

  return <div className="min-w-0 space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold md:text-3xl">Comparador de mods</h1><p className="mt-1 text-sm text-muted-foreground">Versões dos manifests em Plugins, Whitelist e Greylist dos dois servidores.</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => action.mutate('background-start')} disabled={running || action.isPending}><RefreshCw className={`mr-2 h-4 w-4 ${running ? 'animate-spin' : ''}`} />Sincronizar</Button>{resumable && canManage && <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate('background-resume')}>Continuar</Button>}{(running || resumable) && canManage && <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate('background-cancel')}>Cancelar</Button>}</div></div>
    <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground"><p>{snapshot?.synced_at ? `Última sincronização: ${new Date(snapshot.synced_at).toLocaleString('pt-BR')}` : 'Nenhuma sincronização concluída.'} A atualização só começa ao clicar em Sincronizar.</p>{running && <p className="mt-2 text-foreground" role="status">{job.stage}: {job.done}/{job.total}. Você pode sair desta tela ou fechar a aba.</p>}{resumable && <p className="mt-2 text-amber-500" role="status">{job.message || 'A sincronização foi pausada. Clique em Continuar para retomar.'}</p>}{job?.status === 'cancelled' && <p className="mt-2">Sincronização cancelada. O último resultado concluído foi preservado.</p>}{snapshotQuery.isError && <p className="mt-2 text-destructive" role="alert">Não foi possível carregar o resultado: {snapshotQuery.error.message}</p>}{action.error && <p className="mt-2 text-destructive" role="alert">{action.error.message}</p>}</div>
    <div className="flex flex-wrap items-center gap-4"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por mod ou pasta..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={onlyDifferences} onCheckedChange={(checked) => setOnlyDifferences(Boolean(checked))} />Somente diferenças</label></div>
    <p className="text-xs text-muted-foreground">A comparação usa o nome da pasta e verifica as versões entre servidores na mesma categoria. O manifest da pasta é consultado primeiro; quando não existe, a busca é limitada a 20 subpastas, 4 níveis e um limite de tempo por mod. Arquivos DLL soltos e pastas sem manifest não têm versão identificada; nomes diferentes podem representar o mesmo mod.</p>
    <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-secondary/50"><tr><th className="p-3">Mod / pasta</th>{MOD_SOURCES.flatMap((source) => MOD_SERVERS.map((server) => <th className="p-3" key={`${server.key}:${source.key}`}>{source.label}<br /><span className="text-xs font-normal text-muted-foreground">{server.label}</span></th>))}</tr></thead><tbody>{rows.map((row) => <tr className="border-t border-border" key={row.key}><td className="p-3"><p className="font-medium">{row.name}</p><p className="break-all text-xs text-muted-foreground">{row.folder}</p>{row.divergent && <span className="text-xs text-amber-500">Diferença entre servidores</span>}</td>{MOD_SOURCES.flatMap((source) => MOD_SERVERS.map((server) => <td className="p-3" key={`${server.key}:${source.key}`}><VersionCell entry={row.cells[`${server.key}:${source.key}`]} /></td>))}</tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-sm text-muted-foreground">{snapshot ? 'Nenhum mod corresponde aos filtros.' : 'Clique em Sincronizar para consultar os servidores.'}</p>}</div>
  </div>;
}
