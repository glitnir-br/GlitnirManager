import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isSameMonth, subMonths } from 'date-fns';
import {
  AlertTriangle,
  Ban,
  CircleDollarSign,
  Coins,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  UserRoundX,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { base44, supabase } from '@/api/dbClient';
import RecentActivity from '@/components/dashboard/RecentActivity';
import StatCard from '@/components/dashboard/StatCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import { SERVERS } from '@/lib/ServerContext';

const SERVER_OPTIONS = [{ value: 'all', label: 'Todos os servidores' }, ...SERVERS];
const SERVER_LABELS = Object.fromEntries(SERVERS.map((server) => [server.value, server.label]));
const PIE_COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444'];
const POWER_STATE_LABELS = { running: 'Ligado', offline: 'Desligado', starting: 'Iniciando', stopping: 'Desligando', unavailable: 'Indisponível' };
const countdownLabel = (effectiveAt, now) => {
  const seconds = Math.max(0, Math.ceil((new Date(effectiveAt).getTime() - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const maintenancePhase = (status, now) => status?.phase === 'scheduled' && new Date(status.effectiveAt).getTime() > now
  ? 'scheduled'
  : status?.enabled ? 'active' : 'normal';

const money = (value) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const recordDate = (record) => new Date(record.data || record.created_date);
const hasCharacter = (player) => Array.isArray(player.personagens) && player.personagens.some(Boolean);
const steamKey = (record) => String(record.steamid || '').replace(/^Steam_/i, '').trim().toLowerCase() || `registro:${record.id}`;
const formatLatestSync = (records) => {
  const latest = records.reduce((current, value) => {
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) && timestamp > current ? timestamp : current;
  }, 0);
  return latest ? new Date(latest).toLocaleString('pt-BR') : 'Nunca sincronizado';
};

async function maintenanceApi(body) {
  if (!supabase) throw new Error('A manutenção exige conexão com o Supabase.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre novamente no sistema.');
  const response = await fetch('/api/server-maintenance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Falha ao consultar a manutenção.');
  return result;
}

const uniquePlayersBySteamId = (records) => {
  const grouped = new Map();
  records.forEach((player) => {
    const key = steamKey(player);
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { ...player, personagens: player.personagens?.filter(Boolean) || [] });
      return;
    }
    grouped.set(key, {
      ...current,
      status: current.status === 'ativo' || player.status === 'ativo' ? 'ativo' : current.status,
      guilda: current.guilda || player.guilda,
      personagens: [...new Set([...(current.personagens || []), ...(player.personagens || []).filter(Boolean)])],
    });
  });
  return [...grouped.values()];
};

export default function Dashboard() {
  const [dashboardServer, setDashboardServer] = useState('all');
  const [syncMessage, setSyncMessage] = useState('');
  const [maintenanceTarget, setMaintenanceTarget] = useState('todos');
  const [maintenanceConfirmation, setMaintenanceConfirmation] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryOptions = { refetchOnWindowFocus: true, staleTime: 0 };
  const playersQuery = useQuery({ queryKey: ['dashboard', 'players'], queryFn: () => base44.entities.Player.list(), ...queryOptions });
  const financasQuery = useQuery({ queryKey: ['dashboard', 'financas'], queryFn: () => base44.entities.Financa.list(), ...queryOptions });
  const comprasQuery = useQuery({ queryKey: ['dashboard', 'compras'], queryFn: () => base44.entities.Compra.list(), ...queryOptions });
  const despesasQuery = useQuery({ queryKey: ['dashboard', 'despesas'], queryFn: () => base44.entities.Despesa.list(), ...queryOptions });
  const banidosQuery = useQuery({ queryKey: ['dashboard', 'banidos'], queryFn: () => base44.entities.Banido.list(), ...queryOptions });
  const maintenanceQuery = useQuery({ queryKey: ['server-maintenance'], queryFn: () => maintenanceApi({ action: 'status' }), ...queryOptions, refetchInterval: 15000, refetchIntervalInBackground: true });

  useEffect(() => {
    if (!syncMessage) return undefined;
    const timer = window.setTimeout(() => setSyncMessage(''), 5000);
    return () => window.clearTimeout(timer);
  }, [syncMessage]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const scheduledServers = (maintenanceQuery.data?.servers || []).filter((item) => item.phase === 'scheduled');
    if (maintenanceTarget === 'todos' && scheduledServers.length === 1) setMaintenanceTarget(scheduledServers[0].server);
  }, [maintenanceQuery.data, maintenanceTarget]);

  const globalSyncMutation = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error('A sincronização exige conexão com o Supabase.');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão expirada. Entre novamente no sistema.');

      const sync = async (endpoint, server) => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ server }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Falha ao sincronizar ${server}.`);
        return result;
      };

      const jobs = SERVERS.flatMap(({ value }) => [
        { server: value, type: 'whitelist', run: () => sync('/api/sync-whitelist', value) },
        { server: value, type: 'banidos', run: () => sync('/api/sync-banlist', value) },
      ]);
      const results = await Promise.allSettled(jobs.map(async (job) => ({ ...job, result: await job.run() })));
      return results.map((result, index) => ({
        server: jobs[index].server,
        type: jobs[index].type,
        success: result.status === 'fulfilled',
        result: result.status === 'fulfilled' ? result.value.result : null,
        error: result.status === 'rejected' ? result.reason.message : null,
      }));
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['server-maintenance'] });
      const successful = results.filter((item) => item.success).length;
      const failed = results.filter((item) => !item.success);
      setSyncMessage(failed.length
        ? `${successful}/4 sincronizações concluídas. ${failed.map((item) => `${SERVER_LABELS[item.server]} (${item.type}): ${item.error}`).join(' · ')}`
        : 'Whitelist e banidos sincronizados com sucesso nos dois servidores.');
    },
    onError: (error) => setSyncMessage(error.message),
  });

  const maintenanceMutation = useMutation({
    mutationFn: ({ action, enabled, server }) => maintenanceApi({ action, enabled, server }),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(['server-maintenance'], result);
      setMaintenanceConfirmation(null);
      setSyncMessage(variables.action === 'abort' ? 'Manutenção abortada antes do prazo.' : variables.enabled ? 'Manutenção agendada para daqui a 5 minutos.' : 'Manutenção desativada.');
    },
    onError: (error) => setSyncMessage(error.message),
  });

  const filterServer = (items = []) => dashboardServer === 'all'
    ? items
    : items.filter((item) => item.server === dashboardServer);

  const players = filterServer(playersQuery.data);
  const financas = filterServer(financasQuery.data);
  const compras = filterServer(comprasQuery.data);
  const despesas = filterServer(despesasQuery.data);
  const banidos = filterServer(banidosQuery.data);
  const lastUpdated = formatLatestSync([
    ...players.map((player) => player.whitelist_synced_at),
    ...banidos.map((banido) => banido.banlist_synced_at),
  ]);
  const isLoading = [playersQuery, financasQuery, comprasQuery, despesasQuery, banidosQuery].some((query) => query.isLoading);
  const maintenanceStatuses = maintenanceQuery.data?.servers || [];
  const activeMaintenance = maintenanceStatuses.filter((item) => item.enabled);
  const targetStatuses = maintenanceTarget === 'todos'
    ? maintenanceStatuses
    : maintenanceStatuses.filter((item) => item.server === maintenanceTarget);
  const targetCanManageMaintenance = targetStatuses.length > 0 && targetStatuses.every((item) => item.powerState === 'running');
  const targetCanScheduleMaintenance = targetCanManageMaintenance && targetStatuses.every((item) => !item.enabled);
  const targetCanAbortMaintenance = targetCanManageMaintenance && targetStatuses.length > 0 && targetStatuses.every((item) => maintenancePhase(item, currentTime) === 'scheduled');
  const targetCanDeactivateMaintenance = targetCanManageMaintenance && targetStatuses.length > 0 && targetStatuses.every((item) => maintenancePhase(item, currentTime) === 'active');

  const now = new Date();
  const previousMonth = subMonths(now, 1);
  const currentDonations = financas.filter((item) => isSameMonth(recordDate(item), now));
  const currentPurchases = compras.filter((item) => isSameMonth(recordDate(item), now));
  const currentExpenses = despesas.filter((item) => isSameMonth(recordDate(item), now));
  const previousRevenue = [
    ...financas.filter((item) => isSameMonth(recordDate(item), previousMonth)),
    ...compras.filter((item) => isSameMonth(recordDate(item), previousMonth)),
  ].reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const currentRevenue = [...currentDonations, ...currentPurchases].reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const currentExpenseTotal = currentExpenses.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const currentBalance = currentRevenue - currentExpenseTotal;
  const revenueChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : null;

  const whitelistPlayers = uniquePlayersBySteamId(players.filter((player) => player.na_whitelist));
  const activePlayers = whitelistPlayers.filter((player) => player.status === 'ativo');
  const playersWithoutCharacter = whitelistPlayers.filter((player) => !hasCharacter(player));
  const playersWithoutGuild = whitelistPlayers.filter((player) => !player.guilda);
  const pendingDonations = financas.filter((finance) => !finance.moeda_enviada);
  const uniqueBannedPlayers = new Set(
    banidos.filter((item) => item.na_banlist !== false).map(steamKey),
  ).size;

  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = subMonths(now, 5 - index);
      const inMonth = (item) => isSameMonth(recordDate(item), monthDate);
      const donations = financas.filter(inMonth).reduce((sum, item) => sum + Number(item.valor || 0), 0);
      const packages = compras.filter(inMonth).reduce((sum, item) => sum + Number(item.valor || 0), 0);
      const expenses = despesas.filter(inMonth).reduce((sum, item) => sum + Number(item.valor || 0), 0);
      return { month: format(monthDate, 'MM/yy'), arrecadado: donations + packages, despesas: expenses };
    });
  }, [dashboardServer, financasQuery.data, comprasQuery.data, despesasQuery.data]);

  const guildData = useMemo(() => {
    const totals = whitelistPlayers.reduce((acc, player) => {
      const guild = player.guilda || 'Sem guilda';
      acc[guild] = (acc[guild] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [dashboardServer, playersQuery.data]);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Dashboard Global</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visão consolidada operacional e financeira da Glitnir</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
          <div className="w-full sm:w-56">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Visualizar</label>
            <Select value={dashboardServer} onValueChange={setDashboardServer}>
              <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>{SERVER_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            {['adm_principal', 'administrador'].includes(user?.role) && (
              <Button
                variant="outline"
                className="gap-2"
                disabled={globalSyncMutation.isPending}
                onClick={() => { setSyncMessage(''); globalSyncMutation.mutate(); }}
              >
                <RefreshCw className={`h-4 w-4 ${globalSyncMutation.isPending ? 'animate-spin' : ''}`} />
                {globalSyncMutation.isPending ? 'Sincronizando...' : 'Sincronizar servidores'}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">Última atualização: {lastUpdated}</span>
          </div>
        </div>
      </div>

      {syncMessage && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${globalSyncMutation.isError || syncMessage.includes('/4') ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
          {syncMessage}
        </div>
      )}

      <div className={`rounded-xl border p-5 ${activeMaintenance.length ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card'}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><AlertTriangle className={`h-5 w-5 ${activeMaintenance.length ? 'text-amber-400' : 'text-muted-foreground'}`} /><h2 className="font-semibold text-foreground">Manutenção dos servidores</h2></div>
            <p className="mt-1 text-sm text-muted-foreground">Controlada pelo arquivo <code className="text-foreground">/BepInEx/config/maintenance</code>. O status é consultado automaticamente a cada 15 segundos.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {maintenanceQuery.isLoading ? <span className="text-xs text-muted-foreground">Verificando status...</span> : SERVERS.map(({ value, label }) => {
                const status = maintenanceStatuses.find((item) => item.server === value);
                const enabled = status?.enabled;
                const powerState = status?.powerState || 'unavailable';
                const phase = maintenancePhase(status, currentTime);
                const maintenanceLabel = enabled === null || enabled === undefined ? 'Manutenção desconhecida' : phase === 'scheduled' ? `Agendada · ${countdownLabel(status.effectiveAt, currentTime)}` : enabled ? 'Em manutenção' : 'Sem manutenção';
                return <span key={value} className={`rounded-full px-2.5 py-1 text-xs font-medium ${powerState === 'running' ? enabled ? 'bg-amber-500/15 text-amber-300' : 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>{label}: {POWER_STATE_LABELS[powerState] || powerState} · {maintenanceLabel}</span>;
              })}
            </div>
          </div>
          {['adm_principal', 'administrador'].includes(user?.role) && <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="w-full sm:w-48"><Label className="mb-1.5 block text-xs text-muted-foreground">Aplicar em</Label><Select value={maintenanceTarget} onValueChange={setMaintenanceTarget}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os servidores</SelectItem><SelectItem value="server_1">Server 1</SelectItem><SelectItem value="server_2">Server 2</SelectItem></SelectContent></Select></div>
            <div className="flex gap-2">{targetCanScheduleMaintenance && <Button variant="outline" disabled={maintenanceMutation.isPending} onClick={() => setMaintenanceConfirmation('schedule')}>Ativar Manutenção</Button>}{targetCanAbortMaintenance && <Button variant="destructive" disabled={maintenanceMutation.isPending} onClick={() => setMaintenanceConfirmation('abort')}>Abortar manutenção</Button>}{targetCanDeactivateMaintenance && <Button variant="destructive" disabled={maintenanceMutation.isPending} onClick={() => setMaintenanceConfirmation('deactivate')}>Desativar Manutenção</Button>}</div>
          </div>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Players ativos" value={activePlayers.length} icon={Users} glowColor="#3b82f6" subtitle={`${whitelistPlayers.length} na whitelist`} />
        <StatCard title="Sem personagem" value={playersWithoutCharacter.length} icon={UserRoundX} glowColor="#f59e0b" subtitle="Players que precisam de identificação" />
        <StatCard title="Banidos" value={uniqueBannedPlayers} icon={Ban} glowColor="#ef4444" subtitle="Steam IDs únicos banidos" />
        <StatCard title="Arrecadado no mês" value={money(currentRevenue)} icon={CircleDollarSign} glowColor="#a855f7" subtitle={revenueChange === null ? 'Sem comparação anterior' : `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}% versus mês anterior`} />
        <StatCard title="Saldo líquido do mês" value={money(currentBalance)} icon={currentBalance >= 0 ? TrendingUp : TrendingDown} glowColor={currentBalance >= 0 ? '#22c55e' : '#ef4444'} subtitle={`${money(currentExpenseTotal)} em despesas`} />
        <StatCard title="Moeda Glitnir pendente" value={pendingDonations.reduce((sum, item) => sum + Number(item.gc || 0), 0)} icon={Coins} glowColor="#f59e0b" subtitle={`${pendingDonations.length} doações aguardando envio`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground">Movimentação dos últimos 6 meses</h2>
          <p className="mb-5 text-xs text-muted-foreground">Arrecadação comparada às despesas</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} width={58} />
                <Tooltip formatter={(value) => money(value)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="arrecadado" name="Arrecadado" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground">Players por guilda</h2>
          <p className="mb-5 text-xs text-muted-foreground">Distribuição dos players presentes na whitelist</p>
          <div className="h-72">
            {guildData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={guildData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {guildData.map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Nenhum player na whitelist.</div>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5">
        <div className="mb-4 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" /><h2 className="font-semibold text-foreground">Pendências</h2></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PendingItem label="Doação não enviada" value={pendingDonations.length} />
          <PendingItem label="Players sem personagem" value={playersWithoutCharacter.length} />
          <PendingItem label="Players sem guilda" value={playersWithoutGuild.length} />
        </div>
      </div>

      <RecentActivity players={players} financas={financas} banidos={banidos} serverLabels={SERVER_LABELS} showServer={dashboardServer === 'all'} />
      <Dialog open={maintenanceConfirmation !== null} onOpenChange={(open) => !open && setMaintenanceConfirmation(null)}><DialogContent><DialogHeader><DialogTitle>{maintenanceConfirmation === 'schedule' ? 'Agendar manutenção?' : maintenanceConfirmation === 'abort' ? 'Abortar manutenção?' : 'Desativar manutenção?'}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{maintenanceConfirmation === 'schedule' ? 'Será criado o arquivo maintenance e a contagem de 5 minutos será iniciada.' : maintenanceConfirmation === 'abort' ? 'O arquivo maintenance será removido e a contagem será interrompida.' : 'O arquivo maintenance será removido para liberar o servidor.'} Destino: <strong className="text-foreground">{maintenanceTarget === 'todos' ? 'Todos os servidores' : SERVER_LABELS[maintenanceTarget]}</strong>.</p><DialogFooter><Button variant="outline" onClick={() => setMaintenanceConfirmation(null)} disabled={maintenanceMutation.isPending}>Cancelar</Button><Button variant={maintenanceConfirmation === 'deactivate' ? 'destructive' : 'default'} onClick={() => maintenanceMutation.mutate(maintenanceConfirmation === 'abort' ? { action: 'abort', server: maintenanceTarget } : { action: 'set', enabled: maintenanceConfirmation === 'schedule', server: maintenanceTarget })} disabled={maintenanceMutation.isPending}>{maintenanceMutation.isPending ? 'Aplicando...' : 'Confirmar'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function PendingItem({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card/70 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-lg font-bold text-amber-400">{value}</span>
    </div>
  );
}
