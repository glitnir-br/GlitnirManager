import React, { useMemo, useState } from 'react';
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
import { useAuth } from '@/lib/AuthContext';
import { SERVERS } from '@/lib/ServerContext';

const SERVER_OPTIONS = [{ value: 'all', label: 'Todos os servidores' }, ...SERVERS];
const SERVER_LABELS = Object.fromEntries(SERVERS.map((server) => [server.value, server.label]));
const PIE_COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444'];

const money = (value) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const recordDate = (record) => new Date(record.data || record.created_date);
const hasCharacter = (player) => Array.isArray(player.personagens) && player.personagens.some(Boolean);
const steamKey = (record) => String(record.steamid || '').replace(/^Steam_/i, '').trim().toLowerCase() || `registro:${record.id}`;

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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryOptions = { refetchOnWindowFocus: true, staleTime: 0 };
  const playersQuery = useQuery({ queryKey: ['dashboard', 'players'], queryFn: () => base44.entities.Player.list(), ...queryOptions });
  const financasQuery = useQuery({ queryKey: ['dashboard', 'financas'], queryFn: () => base44.entities.Financa.list(), ...queryOptions });
  const comprasQuery = useQuery({ queryKey: ['dashboard', 'compras'], queryFn: () => base44.entities.Compra.list(), ...queryOptions });
  const despesasQuery = useQuery({ queryKey: ['dashboard', 'despesas'], queryFn: () => base44.entities.Despesa.list(), ...queryOptions });
  const banidosQuery = useQuery({ queryKey: ['dashboard', 'banidos'], queryFn: () => base44.entities.Banido.list(), ...queryOptions });

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
      const successful = results.filter((item) => item.success).length;
      const failed = results.filter((item) => !item.success);
      setSyncMessage(failed.length
        ? `${successful}/4 sincronizações concluídas. ${failed.map((item) => `${SERVER_LABELS[item.server]} (${item.type}): ${item.error}`).join(' · ')}`
        : 'Whitelist e banidos sincronizados com sucesso nos dois servidores.');
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
  const isLoading = [playersQuery, financasQuery, comprasQuery, despesasQuery, banidosQuery].some((query) => query.isLoading);

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
        </div>
      </div>

      {syncMessage && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${globalSyncMutation.isError || syncMessage.includes('/4') ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
          {syncMessage}
        </div>
      )}

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
