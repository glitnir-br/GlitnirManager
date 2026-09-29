import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BARS = [
  { key: 'financas', label: 'Finanças', color: '#a855f7' },
  { key: 'compras', label: 'Compras', color: '#eab308' },
  { key: 'despesas', label: 'Despesas', color: '#ef4444' },
];

const formatMonth = (monthKey) => {
  try {
    return format(parseISO(`${monthKey}-01`), 'MMM/yy', { locale: ptBR });
  } catch { return monthKey; }
};

const formatCurrency = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

export default function CategoryComparisonChart({ data, activeCategories }) {
  const chartData = data.map(row => ({ ...row, month: formatMonth(row.month) }));

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Comparativo por Categoria</h2>
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-56 text-muted-foreground text-sm">Nenhum dado para o período selecionado</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <YAxis tickFormatter={formatCurrency} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value) => [formatCurrency(value)]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {BARS.filter(b => activeCategories.includes(b.key)).map(bar => (
              <Bar key={bar.key} dataKey={bar.key} name={bar.label} fill={bar.color} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}