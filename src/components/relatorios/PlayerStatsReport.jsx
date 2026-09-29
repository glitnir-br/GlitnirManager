import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, UserX, UserCheck, ShieldOff } from 'lucide-react';

function getMonthKey(dateStr) {
  const d = dateStr ? parseISO(dateStr) : null;
  if (!d || !isValid(d)) return null;
  return format(d, 'yyyy-MM');
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return format(d, 'MMM/yy', { locale: ptBR });
}

export default function PlayerStatsReport({ selectedYear }) {
  const { data: playersRaw = [] } = useQuery({ queryKey: ['players'], queryFn: () => base44.entities.Player.list() });
  const { data: banidosRaw = [] } = useQuery({ queryKey: ['banidos'], queryFn: () => base44.entities.Banido.list() });

  // Players registered per month
  const monthlyPlayers = useMemo(() => {
    const months = {};
    playersRaw.forEach(p => {
      const key = getMonthKey(p.created_date?.slice(0, 10));
      if (!key) return;
      if (!months[key]) months[key] = { month: key, novos: 0, ativos: 0, banidos_mes: 0 };
      months[key].novos += 1;
    });

    banidosRaw.forEach(b => {
      const key = getMonthKey(b.created_date?.slice(0, 10));
      if (!key) return;
      if (!months[key]) months[key] = { month: key, novos: 0, ativos: 0, banidos_mes: 0 };
      months[key].banidos_mes += 1;
    });

    return Object.values(months)
      .sort((a, b) => a.month.localeCompare(b.month))
      .filter(r => r.month.startsWith(selectedYear));
  }, [playersRaw, banidosRaw, selectedYear]);

  // Overall stats
  const stats = useMemo(() => {
    const ativos = playersRaw.filter(p => p.status === 'ativo').length;
    const inativos = playersRaw.filter(p => p.status === 'inativo').length;
    const suspensos = playersRaw.filter(p => p.status === 'suspenso').length;
    const totalBanidos = banidosRaw.length;
    return { total: playersRaw.length, ativos, inativos, suspensos, totalBanidos };
  }, [playersRaw, banidosRaw]);

  const statCards = [
    { label: 'Total de Players', value: stats.total, icon: Users, color: 'text-primary' },
    { label: 'Ativos', value: stats.ativos, icon: UserCheck, color: 'text-green-400' },
    { label: 'Inativos/Suspensos', value: stats.inativos + stats.suspensos, icon: UserX, color: 'text-yellow-400' },
    { label: 'Banidos', value: stats.totalBanidos, icon: ShieldOff, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Relatório de Players</h2>
        <p className="text-sm text-muted-foreground">Visão geral de membros e banimentos</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
            <Icon className={`w-6 h-6 ${color}`} />
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart: novos players e banimentos por mês */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Novos players & banimentos por mês ({selectedYear})
        </h3>
        {monthlyPlayers.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">Sem dados para este período</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyPlayers.map(r => ({ ...r, month: formatMonthLabel(r.month) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend wrapperStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <Bar dataKey="novos" name="Novos Players" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="banidos_mes" name="Banimentos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}