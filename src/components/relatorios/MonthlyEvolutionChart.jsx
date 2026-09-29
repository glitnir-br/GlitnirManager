import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LINES = [
  { key: 'financas', label: 'Finanças', color: '#a855f7' },
  { key: 'compras', label: 'Compras', color: '#eab308' },
  { key: 'despesas', label: 'Despesas', color: '#ef4444' },
  { key: 'saldo', label: 'Saldo', color: '#22c55e', alwaysShow: true, strokeDasharray: '5 3' },
];

const formatMonth = (monthKey) => {
  try {
    return format(parseISO(`${monthKey}-01`), 'MMM/yy', { locale: ptBR });
  } catch { return monthKey; }
};

const formatCurrency = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

export default function MonthlyEvolutionChart({ data, activeCategories }) {
  const chartData = data.map(row => ({ ...row, month: formatMonth(row.month) }));

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Evolução Mensal</h2>
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-56 text-muted-foreground text-sm">Nenhum dado para o período selecionado</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <YAxis tickFormatter={formatCurrency} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value) => [formatCurrency(value)]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {LINES.filter(l => l.alwaysShow || activeCategories.includes(l.key)).map(line => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label}
                stroke={line.color}
                strokeWidth={line.alwaysShow ? 2.5 : 2}
                strokeDasharray={line.strokeDasharray}
                dot={{ r: 4, fill: line.color }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
