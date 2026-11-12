import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/api/dbClient';
import { compareMods, MOD_SERVERS, MOD_SOURCES } from '@/lib/modComparison';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const pause = (ms, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) return reject(new DOMException('Cancelado', 'AbortError'));
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
  const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); };
  signal.addEventListener('abort', abort, { once: true });
});

async function request(body, signal) {
  if (!supabase) throw new Error('A consulta exige conexão com o Supabase.');
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Sessão expirada. Entre novamente.');
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch('/api/mod-comparison', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body), signal });
    const result = await response.json().catch(() => ({}));
    if (response.ok) return result;
    if (response.status !== 429 || attempt === 3) throw new Error(result.error || 'Falha ao consultar mods.');
    const retry = Number(response.headers.get('retry-after'));
    await pause(Math.min(30, Number.isFinite(retry) && retry > 0 ? retry : 2 ** (attempt + 1)) * 1000, signal);
  }
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
  const queryClient = useQueryClient();
  const controller = useRef(null);
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const snapshotQuery = useQuery({ queryKey: ['mod-comparison'], queryFn: () => request({ action: 'get' }), refetchOnWindowFocus: false, retry: false, staleTime: Infinity });
  const snapshot = snapshotQuery.data?.snapshot;
  const rows = useMemo(() => compareMods(snapshot?.entries || []).filter((row) => (!onlyDifferences || row.divergent) && `${row.name} ${row.folder}`.toLowerCase().includes(search.trim().toLowerCase())), [snapshot, onlyDifferences, search]);
  useEffect(() => () => controller.current?.abort(), []);

  const synchronize = async () => {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    let token = null; let saving = false;
    setMessage(''); setProgress({ stage: 'Consultando pastas', done: 0, total: 6 });
    try {
      ({ token } = await request({ action: 'start' }, abort.signal));
      const tasks = []; const entries = [];
      let rootsDone = 0;
      for (const server of MOD_SERVERS) for (const category of MOD_SOURCES) {
        const result = await request({ action: 'root', server: server.key, category: category.key, token }, abort.signal);
        for (const item of result.entries) {
          const base = { server: server.key, category: category.key, folder: item.folder };
          if (item.isDirectory) tasks.push(base);
          else entries.push({ ...base, name: item.folder, version: '', status: 'file' });
        }
        setProgress({ stage: 'Consultando pastas', done: ++rootsDone, total: 6 });
        await pause(250, abort.signal);
      }
      setProgress({ stage: 'Lendo manifests', done: 0, total: tasks.length });
      for (const [index, task] of tasks.entries()) {
        const pending = ['']; let visited = 0; let limited = false; let entry = null;
        while (pending.length && visited < 200) {
          const relativePath = pending.shift(); visited += 1;
          setProgress({ stage: `Lendo manifests · ${task.folder} (${visited} pastas)`, done: index, total: tasks.length });
          const result = await request({ action: 'manifest', ...task, relativePath, token }, abort.signal);
          entry = result.entry;
          if (entry.status !== 'missing') break;
          for (const child of result.subfolders || []) {
            const next = relativePath ? `${relativePath}/${child}` : child;
            if (next.split('/').length <= 8 && next.length <= 1000) pending.push(next);
            else limited = true;
          }
          await pause(250, abort.signal);
        }
        if (entry?.status === 'missing' && (limited || pending.length)) entry.status = 'incomplete';
        entries.push(entry);
        setProgress({ stage: 'Lendo manifests', done: index + 1, total: tasks.length });
        await pause(250, abort.signal);
      }
      saving = true; setProgress({ stage: 'Salvando resultado', done: entries.length, total: entries.length, saving: true });
      const result = await request({ action: 'save', entries, token }, abort.signal);
      token = null;
      queryClient.setQueryData(['mod-comparison'], result);
      setMessage(`Sincronização concluída: ${entries.length} registros.`);
    } catch (error) {
      if (saving) {
        queryClient.invalidateQueries({ queryKey: ['mod-comparison'] });
        setMessage('Não foi possível confirmar o salvamento. Confira a data do último resultado antes de sincronizar novamente.');
      } else setMessage(error.name === 'AbortError' ? 'Sincronização cancelada. O resultado anterior foi preservado.' : `Sincronização não concluída: ${error.message}. O resultado anterior foi preservado.`);
    } finally {
      if (token) await request({ action: 'cancel', token }, AbortSignal.timeout(5000)).catch(() => {});
      controller.current = null; setProgress(null);
    }
  };

  return <div className="min-w-0 space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold md:text-3xl">Comparador de mods</h1><p className="mt-1 text-sm text-muted-foreground">Versões dos manifests em Plugins, Whitelist e Greylist dos dois servidores.</p></div><div className="flex flex-wrap gap-2"><Button onClick={synchronize} disabled={!!progress}><RefreshCw className={`mr-2 h-4 w-4 ${progress ? 'animate-spin' : ''}`} />Sincronizar</Button>{progress && !progress.saving && <Button variant="outline" onClick={() => controller.current?.abort()}>Cancelar</Button>}</div></div>
    <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground"><p>{snapshot?.synced_at ? `Última sincronização: ${new Date(snapshot.synced_at).toLocaleString('pt-BR')}` : 'Nenhuma sincronização concluída.'} A atualização ocorre somente ao clicar em Sincronizar.</p>{progress && <p className="mt-2 text-foreground" role="status">{progress.stage}: {progress.done}/{progress.total}. A leitura é feita gradualmente.</p>}{message && <p className="mt-2 text-foreground" role="status">{message}</p>}{snapshotQuery.isError && <p className="mt-2 text-destructive" role="alert">Não foi possível carregar o resultado salvo: {snapshotQuery.error.message}</p>}</div>
    <div className="flex flex-wrap items-center gap-4"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por mod ou pasta..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={onlyDifferences} onCheckedChange={(checked) => setOnlyDifferences(Boolean(checked))} />Somente diferenças</label></div>
    <p className="text-xs text-muted-foreground">A comparação usa o nome da pasta e verifica as versões entre servidores na mesma categoria. Se não houver manifest na raiz do mod, subpastas são consultadas gradualmente, até 200 pastas e 8 níveis por mod. Arquivos DLL soltos e pastas sem manifest não têm versão identificada; nomes diferentes podem representar o mesmo mod.</p>
    <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-secondary/50"><tr><th className="p-3">Mod / pasta</th>{MOD_SOURCES.flatMap((source) => MOD_SERVERS.map((server) => <th className="p-3" key={`${server.key}:${source.key}`}>{source.label}<br /><span className="text-xs font-normal text-muted-foreground">{server.label}</span></th>))}</tr></thead><tbody>{rows.map((row) => <tr className="border-t border-border" key={row.key}><td className="p-3"><p className="font-medium">{row.name}</p><p className="break-all text-xs text-muted-foreground">{row.folder}</p>{row.divergent && <span className="text-xs text-amber-500">Diferença entre servidores</span>}</td>{MOD_SOURCES.flatMap((source) => MOD_SERVERS.map((server) => <td className="p-3" key={`${server.key}:${source.key}`}><VersionCell entry={row.cells[`${server.key}:${source.key}`]} /></td>))}</tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-sm text-muted-foreground">{snapshot ? 'Nenhum mod corresponde aos filtros.' : 'Clique em Sincronizar para consultar os servidores.'}</p>}</div>
  </div>;
}
