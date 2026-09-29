import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Users, DollarSign, ShoppingCart } from 'lucide-react';

export default function RecentActivity({ players, financas, compras }) {
  const recentPlayers = [...players].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);
  const recentFinancas = [...financas].sort((a, b) => {
    const da = a.data || a.created_date?.slice(0, 10) || '';
    const db = b.data || b.created_date?.slice(0, 10) || '';
    return db.localeCompare(da);
  }).slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Recent Players */}
      <div className="rounded-xl bg-card border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Players Recentes</h3>
        </div>
        <div className="space-y-3">
          {recentPlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum player cadastrado ainda.</p>
          ) : (
            recentPlayers.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: p.cor || 'hsl(270, 70%, 55%, 0.2)',
                      color: p.cor ? '#fff' : 'hsl(270, 70%, 55%)',
                    }}
                  >
                    {p.nick?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.nick}</p>
                    <p className="text-xs text-muted-foreground">{p.guilda || 'Sem guilda'}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  p.status === 'ativo' ? 'bg-green-500/15 text-green-400' :
                  p.status === 'banido' ? 'bg-red-500/15 text-red-400' :
                  p.status === 'suspenso' ? 'bg-yellow-500/15 text-yellow-400' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {p.status || 'ativo'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Finances */}
      <div className="rounded-xl bg-card border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-foreground text-sm">Finanças Recentes</h3>
        </div>
        <div className="space-y-3">
          {recentFinancas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma transação registrada ainda.</p>
          ) : (
            recentFinancas.map(f => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{f.nick}</p>
                  <p className="text-xs text-muted-foreground">{f.enviado_por ? `por ${f.enviado_por}` : ''}</p>
                </div>
                <span className="text-sm font-mono font-semibold text-green-400">
                  R$ {(f.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
