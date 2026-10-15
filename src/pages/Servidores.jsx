import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Loader2, Power, RotateCcw, Terminal } from 'lucide-react';
import { supabase } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SERVERS } from '@/lib/ServerContext';

const POWER_STATE_LABELS = { running: 'Ligado', offline: 'Desligado', starting: 'Iniciando', stopping: 'Desligando', unavailable: 'Indisponível' };
const LABELS = Object.fromEntries(SERVERS.map((item) => [item.value, item.label]));

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
  const [consoleServer, setConsoleServer] = useState(null);
  const [consoleOutput, setConsoleOutput] = useState('');
  const [consoleError, setConsoleError] = useState('');
  const socketRef = useRef(null);
  const statusQuery = useQuery({ queryKey: ['server-maintenance'], queryFn: () => serverApi({ action: 'status' }), staleTime: 0, refetchInterval: 15000, refetchIntervalInBackground: true });
  const statuses = statusQuery.data?.servers || [];

  const powerMutation = useMutation({
    mutationFn: ({ signal, server }) => serverApi({ action: 'power', signal, server }),
    onSuccess: (result) => { queryClient.setQueryData(['server-maintenance'], result); setConfirmation(null); },
  });

  useEffect(() => {
    if (!consoleServer) return undefined;
    let cancelled = false;
    setConsoleOutput('Conectando ao console...\n');
    setConsoleError('');
    serverApi({ action: 'websocket', server: consoleServer }).then((result) => {
      const credentials = result?.data || result;
      if (cancelled || !credentials?.socket || !credentials?.token) throw new Error('Credenciais do console indisponíveis.');
      const socket = new WebSocket(credentials.socket);
      socketRef.current = socket;
      socket.onopen = () => socket.send(JSON.stringify({ event: 'auth', args: [credentials.token] }));
      socket.onmessage = ({ data }) => {
        try {
          const message = JSON.parse(data);
          if (message.event === 'console output') setConsoleOutput((current) => `${current}${message.args?.[0] || ''}`.slice(-20000));
          if (message.event === 'auth success') setConsoleOutput((current) => current.replace('Conectando ao console...\n', ''));
        } catch { /* Ignora mensagens não estruturadas do socket. */ }
      };
      socket.onerror = () => setConsoleError('Não foi possível conectar ao console do Pterodactyl.');
      socket.onclose = () => { if (!cancelled) socketRef.current = null; };
    }).catch((error) => { if (!cancelled) setConsoleError(error.message); });
    return () => { cancelled = true; socketRef.current?.close(); socketRef.current = null; };
  }, [consoleServer]);

  const commandLabel = (signal) => ({ start: 'Ligar', restart: 'Reiniciar', stop: 'Desligar' }[signal]);

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-foreground md:text-3xl">Servidores</h1><p className="mt-1 text-sm text-muted-foreground">Controle operacional e console em tempo real do Pterodactyl.</p></div>
    {powerMutation.error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{powerMutation.error.message}</div>}
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">{SERVERS.map(({ value, label }) => {
      const status = statuses.find((item) => item.server === value);
      const state = status?.powerState || 'unavailable';
      const playerCount = Number.isFinite(status?.onlinePlayers) && Number.isFinite(status?.maxPlayers) ? `${status.onlinePlayers}/${status.maxPlayers}` : '—';
      return <section key={value} className="rounded-xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{label}</h2><p className="mt-1 text-sm text-muted-foreground">Players online: <span className="font-medium text-foreground">{playerCount}</span></p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${state === 'running' ? 'bg-green-500/15 text-green-300' : state === 'offline' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>{POWER_STATE_LABELS[state] || state}</span></div><div className="mt-5 grid grid-cols-3 gap-2"><Button size="sm" disabled={powerMutation.isPending || state === 'running' || state === 'starting'} onClick={() => setConfirmation({ server: value, signal: 'start' })}><Power className="mr-1.5 h-3.5 w-3.5" />Ligar</Button><Button size="sm" variant="outline" disabled={powerMutation.isPending || state !== 'running'} onClick={() => setConfirmation({ server: value, signal: 'restart' })}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reiniciar</Button><Button size="sm" variant="destructive" disabled={powerMutation.isPending || state !== 'running'} onClick={() => setConfirmation({ server: value, signal: 'stop' })}>Desligar</Button></div><Button className="mt-3 w-full" variant="secondary" onClick={() => setConsoleServer(value)}><Terminal className="mr-2 h-4 w-4" />Mostrar console</Button></section>;
    })}</div>
    <Dialog open={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}><DialogContent><DialogHeader><DialogTitle>{commandLabel(confirmation?.signal)} {LABELS[confirmation?.server]}?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">O comando será enviado ao Pterodactyl.</p><DialogFooter><Button variant="outline" onClick={() => setConfirmation(null)} disabled={powerMutation.isPending}>Cancelar</Button><Button variant={confirmation?.signal === 'stop' ? 'destructive' : 'default'} disabled={powerMutation.isPending} onClick={() => powerMutation.mutate(confirmation)}>{powerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(consoleServer)} onOpenChange={(open) => !open && setConsoleServer(null)}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Console — {LABELS[consoleServer]}</DialogTitle></DialogHeader>{consoleError ? <p className="text-sm text-red-300">{consoleError}</p> : <pre className="max-h-[60vh] min-h-72 overflow-auto rounded-lg bg-black p-4 font-mono text-xs leading-relaxed text-green-300 whitespace-pre-wrap">{consoleOutput || 'Aguardando saída do servidor...'}</pre>}</DialogContent></Dialog>
  </div>;
}
