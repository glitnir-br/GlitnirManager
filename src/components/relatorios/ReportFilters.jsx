import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MONTHS = [
  { value: 'todos', label: 'Todos os meses' },
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

const CATEGORIES = [
  { key: 'financas', label: 'Finanças', color: 'bg-purple-500' },
  { key: 'compras', label: 'Pacotes Guildas', color: 'bg-yellow-500' },
  { key: 'despesas', label: 'Despesas', color: 'bg-red-500' },
];

export default function ReportFilters({
  selectedYear, onYearChange,
  selectedMonth, onMonthChange,
  activeCategories, onToggleCategory,
  availableYears,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-card border border-border">
      {/* Year */}
      <Select value={selectedYear} onValueChange={onYearChange}>
        <SelectTrigger className="w-28 bg-secondary">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map(y => (
            <SelectItem key={y} value={y}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Month */}
      <Select value={selectedMonth} onValueChange={onMonthChange}>
        <SelectTrigger className="w-44 bg-secondary">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map(m => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-px h-6 bg-border" />

      {/* Category toggles */}
      {CATEGORIES.map(cat => {
        const active = activeCategories.includes(cat.key);
        return (
          <button
            key={cat.key}
            onClick={() => onToggleCategory(cat.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              active
                ? 'border-transparent bg-secondary text-foreground'
                : 'border-border bg-transparent text-muted-foreground opacity-50'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
