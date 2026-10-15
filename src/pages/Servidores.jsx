import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Power, RotateCcw, Server, Users, Wrench } from 'lucide-react';
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

  const commandLabel = (signal) => ({ start: 'Ligar', restart: 'Reiniciar', stop: 'Desligar' }[signal]);
  const maintenanceLabel = (action) => ({ schedule: 'Ativar manutenção', abort: 'Abortar manutenção', deactivate: 'Desativar manutenção' }[action]);

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-foreground md:text-3xl">Servidores</h1><p className="mt-1 text-sm text-muted-foreground">Controle individual de energia, ocupação e manutenção.</p></div>
    {powerMutation.error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{powerMutation.error.message}</div>}
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">{SERVERS.map(({ value, label }) => {
      const status = statuses.find((item) => item.server === value);
      const state = status?.powerState || 'unavailable';
      const playerCount = Number.isFinite(status?.onlinePlayers) && Number.isFinite(status?.maxPlayers) ? `${status.onlinePlayers}/${status.maxPlayers}` : '—';
      const phase = maintenancePhase(status, currentTime);
      const maintenanceText = status?.enabled === null || status?.enabled === undefined ? 'Manutenção desconhecida' : phase === 'scheduled' ? `Agendada · ${countdownLabel(status.effectiveAt, currentTime)}` : status.enabled ? 'Em manutenção' : 'Sem manutenção';
      return <section key={value} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="flex items-start justify-between border-b border-border bg-secondary/30 p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Server className="h-5 w-5" /></div><div><h2 className="text-xl font-semibold">{label}</h2><p className="mt-0.5 text-sm text-muted-foreground">Painel de operação</p></div></div><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${state === 'running' ? 'bg-green-500/15 text-green-300' : state === 'offline' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>{POWER_STATE_LABELS[state] || state}</span></div><div className="space-y-5 p-5"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-border bg-background/40 p-3"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Users className="h-3.5 w-3.5" />Players online</div><p className="mt-1 text-2xl font-bold text-foreground">{playerCount}</p></div><div className="rounded-xl border border-border bg-background/40 p-3"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Wrench className="h-3.5 w-3.5" />Manutenção</div><p className="mt-1 text-sm font-semibold text-foreground">{maintenanceText}</p></div></div><div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Energia</p><div className="grid grid-cols-3 gap-2"><Button disabled={powerMutation.isPending || state === 'running' || state === 'starting'} onClick={() => setConfirmation({ type: 'power', server: value, signal: 'start' })}><Power className="mr-2 h-4 w-4" />Ligar</Button><Button variant="outline" disabled={powerMutation.isPending || state !== 'running'} onClick={() => setConfirmation({ type: 'power', server: value, signal: 'restart' })}><RotateCcw className="mr-2 h-4 w-4" />Reiniciar</Button><Button variant="destructive" disabled={powerMutation.isPending || state !== 'running'} onClick={() => setConfirmation({ type: 'power', server: value, signal: 'stop' })}>Desligar</Button></div></div>{state === 'running' && <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"><p className="mb-3 text-sm font-semibold text-foreground">Manutenção programada</p>{status?.enabled === false && <Button className="w-full" variant="outline" disabled={maintenanceMutation.isPending} onClick={() => setConfirmation({ type: 'maintenance', server: value, action: 'schedule' })}>Ativar manutenção em 5 minutos</Button>}{phase === 'scheduled' && <Button className="w-full" variant="outline" disabled={maintenanceMutation.isPending} onClick={() => setConfirmation({ type: 'maintenance', server: value, action: 'abort' })}>Abortar manutenção programada</Button>}{phase === 'active' && <Button className="w-full" variant="destructive" disabled={maintenanceMutation.isPending} onClick={() => setConfirmation({ type: 'maintenance', server: value, action: 'deactivate' })}>Desativar manutenção</Button>}</div>}</div></section>;
    })}</div>
    <Dialog open={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}><DialogContent><DialogHeader><DialogTitle>{confirmation?.type === 'power' ? commandLabel(confirmation.signal) : maintenanceLabel(confirmation?.action)} {LABELS[confirmation?.server]}?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{confirmation?.type === 'power' ? 'O comando será enviado ao Pterodactyl.' : confirmation?.action === 'schedule' ? 'A manutenção será agendada para iniciar em 5 minutos.' : confirmation?.action === 'abort' ? 'A contagem de manutenção será interrompida.' : 'A manutenção será desativada e o servidor será liberado.'}</p><DialogFooter><Button variant="outline" onClick={() => setConfirmation(null)} disabled={powerMutation.isPending || maintenanceMutation.isPending}>Cancelar</Button><Button variant={confirmation?.signal === 'stop' || confirmation?.action === 'deactivate' ? 'destructive' : 'default'} disabled={powerMutation.isPending || maintenanceMutation.isPending} onClick={() => confirmation?.type === 'power' ? powerMutation.mutate(confirmation) : maintenanceMutation.mutate(confirmation?.action === 'abort' ? { action: 'abort', server: confirmation?.server } : { action: 'set', enabled: confirmation?.action === 'schedule', server: confirmation?.server })}>{(powerMutation.isPending || maintenanceMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
