import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Power, RotateCcw, Terminal } from 'lucide-react';
import { supabase } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SERVERS } from '@/lib/ServerContext';

const POWER_STATE_LABELS = { running: 'Ligado', offline: 'Desligado', starting: 'Iniciando', stopping: 'Desligando', unavailable: 'Indisponível' };
const LABELS = Object.fromEntries(SERVERS.map((item) => [item.value, item.label]));
const maintenancePhase = (status, now) => status?.phase === 'scheduled' && new Date(status.effectiveAt).getTime() > now ? 'scheduled' : status?.enabled ? 'active' : 'normal';
const countdownLabel = (effectiveAt, now) => {
  const seconds = Math.max(0, Math.ceil((new Date(effectiveAt).getTime() - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

async function serverApi(body) {
  if (!supabase) throw new Error('O gerenciamento exige conexão com o Supabase.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre novamente no sistema.');
  const response = await fetch('/api/server-maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Falha ao comunicar com o Pterodactyl.');
  return result;
}

export default function Servidores() {
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [consoleOutput, setConsoleOutput] = useState({});
  const [consoleError, setConsoleError] = useState({});
  const socketRef = useRef([]);
  const statusQuery = useQuery({ queryKey: ['server-maintenance'], queryFn: () => serverApi({ action: 'status' }), staleTime: 0, refetchInterval: 15000, refetchIntervalInBackground: true });
  const statuses = statusQuery.data?.servers || [];

  const powerMutation = useMutation({
    mutationFn: ({ signal, server }) => serverApi({ action: 'power', signal, server }),
    onSuccess: (result) => { queryClient.setQueryData(['server-maintenance'], result); setConfirmation(null); },
  });
  const maintenanceMutation = useMutation({
    mutationFn: ({ action, enabled, server }) => serverApi({ action, enabled, server }),
    onSuccess: (result) => { queryClient.setQueryData(['server-maintenance'], result); setConfirmation(null); },
  });

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    socketRef.current = [];
    SERVERS.forEach(({ value: server }) => {
      setConsoleOutput((current) => ({ ...current, [server]: 'Conectando ao console...\n' }));
      serverApi({ action: 'websocket', server }).then((result) => {
        const credentials = result?.data || result;
        if (cancelled || !credentials?.socket || !credentials?.token) throw new Error('Credenciais do console indisponíveis.');
        const socketUrl = window.location.protocol === 'https:' ? credentials.socket.replace(/^ws:/, 'wss:') : credentials.socket;
        const socket = new WebSocket(socketUrl);
        socketRef.current.push(socket);
        socket.onopen = () => socket.send(JSON.stringify({ event: 'auth', args: [credentials.token] }));
        socket.onmessage = ({ data }) => {
          try {
            const message = JSON.parse(data);
            if (message.event === 'console output') setConsoleOutput((current) => ({ ...current, [server]: `${current[server] || ''}${message.args?.[0] || ''}`.slice(-20000) }));
            if (message.event === 'auth success') setConsoleOutput((current) => ({ ...current, [server]: (current[server] || '').replace('Conectando ao console...\n', '') }));
          } catch { /* Ignora mensagens não estruturadas do socket. */ }
        };
        socket.onerror = () => setConsoleError((current) => ({ ...current, [server]: 'O WebSocket seguro (wss://) do Pterodactyl não está disponível.' }));
      }).catch((error) => { if (!cancelled) setConsoleError((current) => ({ ...current, [server]: error.message })); });
    });
    return () => { cancelled = true; socketRef.current.forEach((socket) => socket.close()); socketRef.current = []; };
  }, []);

  const commandLabel = (signal) => ({ start: 'Ligar', restart: 'Reiniciar', stop: 'Desligar' }[signal]);
  const maintenanceLabel = (action) => ({ schedule: 'Ativar manutenção', abort: 'Abortar manutenção', deactivate: 'Desativar manutenção' }[action]);

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-foreground md:text-3xl">Servidores</h1><p className="mt-1 text-sm text-muted-foreground">Controle operacional e console em tempo real do Pterodactyl.</p></div>
    {powerMutation.error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{powerMutation.error.message}</div>}
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">{SERVERS.map(({ value, label }) => {
      const status = statuses.find((item) => item.server === value);
      const state = status?.powerState || 'unavailable';
      const playerCount = Number.isFinite(status?.onlinePlayers) && Number.isFinite(status?.maxPlayers) ? `${status.onlinePlayers}/${status.maxPlayers}` : '—';
      const phase = maintenancePhase(status, currentTime);
      const maintenanceText = status?.enabled === null || status?.enabled === undefined ? 'Manutenção desconhecida' : phase === 'scheduled' ? `Agendada · ${countdownLabel(status.effectiveAt, currentTime)}` : status.enabled ? 'Em manutenção' : 'Sem manutenção';
      return <section key={value} className="rounded-xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{label}</h2><p className="mt-1 text-sm text-muted-foreground">Players online: <span className="font-medium text-foreground">{playerCount}</span></p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${state === 'running' ? 'bg-green-500/15 text-green-300' : state === 'offline' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>{POWER_STATE_LABELS[state] || state}</span></div><div className="mt-4 rounded-lg bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">{maintenanceText}</div><div className="mt-5 grid grid-cols-3 gap-2"><Button size="sm" disabled={powerMutation.isPending || state === 'running' || state === 'starting'} onClick={() => setConfirmation({ type: 'power', server: value, signal: 'start' })}><Power className="mr-1.5 h-3.5 w-3.5" />Ligar</Button><Button size="sm" variant="outline" disabled={powerMutation.isPending || state !== 'running'} onClick={() => setConfirmation({ type: 'power', server: value, signal: 'restart' })}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reiniciar</Button><Button size="sm" variant="destructive" disabled={powerMutation.isPending || state !== 'running'} onClick={() => setConfirmation({ type: 'power', server: value, signal: 'stop' })}>Desligar</Button></div>{state === 'running' && <div className="mt-3 flex flex-wrap gap-2">{status?.enabled === false && <Button size="sm" variant="outline" disabled={maintenanceMutation.isPending} onClick={() => setConfirmation({ type: 'maintenance', server: value, action: 'schedule' })}>Ativar manutenção</Button>}{phase === 'scheduled' && <Button size="sm" variant="outline" disabled={maintenanceMutation.isPending} onClick={() => setConfirmation({ type: 'maintenance', server: value, action: 'abort' })}>Abortar manutenção</Button>}{phase === 'active' && <Button size="sm" variant="destructive" disabled={maintenanceMutation.isPending} onClick={() => setConfirmation({ type: 'maintenance', server: value, action: 'deactivate' })}>Desativar manutenção</Button>}</div>}<div className="mt-5"><div className="mb-2 flex items-center gap-2 text-sm font-medium"><Terminal className="h-4 w-4 text-primary" />Console</div>{consoleError[value] ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{consoleError[value]}</p> : <pre className="h-64 overflow-auto rounded-lg bg-black p-3 font-mono text-xs leading-relaxed text-green-300 whitespace-pre-wrap">{consoleOutput[value] || 'Aguardando saída do servidor...'}</pre>}</div></section>;
    })}</div>
    <Dialog open={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}><DialogContent><DialogHeader><DialogTitle>{confirmation?.type === 'power' ? commandLabel(confirmation.signal) : maintenanceLabel(confirmation?.action)} {LABELS[confirmation?.server]}?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{confirmation?.type === 'power' ? 'O comando será enviado ao Pterodactyl.' : confirmation?.action === 'schedule' ? 'A manutenção será agendada para iniciar em 5 minutos.' : confirmation?.action === 'abort' ? 'A contagem de manutenção será interrompida.' : 'A manutenção será desativada e o servidor será liberado.'}</p><DialogFooter><Button variant="outline" onClick={() => setConfirmation(null)} disabled={powerMutation.isPending || maintenanceMutation.isPending}>Cancelar</Button><Button variant={confirmation?.signal === 'stop' || confirmation?.action === 'deactivate' ? 'destructive' : 'default'} disabled={powerMutation.isPending || maintenanceMutation.isPending} onClick={() => confirmation?.type === 'power' ? powerMutation.mutate(confirmation) : maintenanceMutation.mutate(confirmation?.action === 'abort' ? { action: 'abort', server: confirmation?.server } : { action: 'set', enabled: confirmation?.action === 'schedule', server: confirmation?.server })}>{(powerMutation.isPending || maintenanceMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
