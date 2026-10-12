import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/dbClient';
import { DollarSign, Users, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import StatCard from '@/components/dashboard/StatCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { useServer } from '@/lib/ServerContext';

export default function Dashboard() {
  const { user } = useAuth();
  const { server, serverLabel } = useServer();
  const { data: players = [] } = useQuery({
    queryKey: ['players', server],
    queryFn: () => base44.entities.Player.filter({ server }),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: financas = [] } = useQuery({
    queryKey: ['financas', server],
    queryFn: () => base44.entities.Financa.filter({ server }),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: compras = [] } = useQuery({
    queryKey: ['compras', server],
    queryFn: () => base44.entities.Compra.filter({ server }),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: despesas = [] } = useQuery({
    queryKey: ['despesas', server],
    queryFn: () => base44.entities.Despesa.filter({ server }),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const totalArrecadado = financas.reduce((sum, f) => sum + (f.valor || 0), 0) + compras.reduce((sum, c) => sum + (c.valor || 0), 0);
  const totalDespesas = despesas.reduce((sum, d) => sum + (d.valor || 0), 0);
  const liquido = totalArrecadado - totalDespesas;
  const totalPlayers = players.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do {serverLabel}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Líquido"
          value={`R$ ${liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          glowColor={liquido >= 0 ? "#22c55e" : "#ef4444"}
          subtitle="Arrecadado - Despesas"
        />
        <StatCard
          title="Total Arrecadado"
          value={`R$ ${totalArrecadado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          glowColor="#a855f7"
          subtitle="Doações + Pacotes Guildas"
        />
        <StatCard
          title="Total Players"
          value={totalPlayers}
          icon={Users}
          glowColor="#3b82f6"
          subtitle="Jogadores cadastrados"
        />
      </div>

      {/* Recent Activity */}
      <RecentActivity players={players} financas={financas} compras={compras} />
    </div>
  );
}
