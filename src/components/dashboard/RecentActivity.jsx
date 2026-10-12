import React from 'react';
import { format } from 'date-fns';
import { Ban, Coins, Users } from 'lucide-react';

const characters = (record) => record.personagem || record.personagens?.filter(Boolean).join(', ') || record.nick || 'Sem personagem';
const dateValue = (record) => new Date(record.data || record.created_date || 0);
const dateLabel = (record) => {
  const date = dateValue(record);
  return Number.isNaN(date.getTime()) ? '-' : format(date, 'dd/MM/yyyy HH:mm');
};

function ServerBadge({ record, serverLabels, showServer }) {
  if (!showServer) return null;
  return <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{serverLabels[record.server] || record.server}</span>;
}

export default function RecentActivity({ players, financas, banidos, serverLabels, showServer }) {
  const recentPlayers = [...players].filter((player) => player.na_whitelist).sort((a, b) => dateValue(b) - dateValue(a)).slice(0, 5);
  const recentDonations = [...financas].sort((a, b) => dateValue(b) - dateValue(a)).slice(0, 5);
  const recentBans = [...banidos].sort((a, b) => dateValue(b) - dateValue(a)).slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <ActivityCard icon={Users} title="Players recentes" empty="Nenhum player na whitelist.">
        {recentPlayers.map((player) => (
          <ActivityRow key={player.id} title={characters(player)} subtitle={`${player.steamid || '-'} · ${player.guilda || 'Sem guilda'}`} date={dateLabel(player)}>
            <ServerBadge record={player} serverLabels={serverLabels} showServer={showServer} />
          </ActivityRow>
        ))}
      </ActivityCard>

      <ActivityCard icon={Coins} title="Doações recentes" empty="Nenhuma doação registrada.">
        {recentDonations.map((finance) => (
          <ActivityRow key={finance.id} title={characters(finance)} subtitle={`${finance.gc || 0} Moeda Glitnir · ${finance.moeda_enviada ? 'Enviado' : 'Não enviado'}`} date={dateLabel(finance)} value={`R$ ${Number(finance.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}>
            <ServerBadge record={finance} serverLabels={serverLabels} showServer={showServer} />
          </ActivityRow>
        ))}
      </ActivityCard>

      <ActivityCard icon={Ban} title="Banimentos recentes" empty="Nenhum banimento registrado.">
        {recentBans.map((ban) => (
          <ActivityRow key={ban.id} title={characters(ban)} subtitle={`${ban.steamid || '-'} · ${ban.motivo || 'OUTRO'}`} date={dateLabel(ban)}>
            <ServerBadge record={ban} serverLabels={serverLabels} showServer={showServer} />
          </ActivityRow>
        ))}
      </ActivityCard>
    </div>
  );
}

function ActivityCard({ icon: Icon, title, empty, children }) {
  const hasItems = React.Children.count(children) > 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">{title}</h3></div>
      <div className="space-y-1">{hasItems ? children : <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>}</div>
    </div>
  );
}

function ActivityRow({ title, subtitle, date, value, children }) {
  return (
    <div className="border-b border-border py-2.5 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-foreground">{title}</p>{children}</div>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {value && <span className="shrink-0 font-mono text-sm font-semibold text-green-400">{value}</span>}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground/70">{date}</p>
    </div>
  );
}
