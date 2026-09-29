import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import ReportFilters from '@/components/relatorios/ReportFilters';
import MonthlyEvolutionChart from '@/components/relatorios/MonthlyEvolutionChart';
import CategoryComparisonChart from '@/components/relatorios/CategoryComparisonChart';
import ReportSummaryCards from '@/components/relatorios/ReportSummaryCards';
import PlayerStatsReport from '@/components/relatorios/PlayerStatsReport';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import FinanceGuardRole from '@/components/FinanceGuardRole';

const CURRENT_YEAR = new Date().getFullYear();

function getMonthKey(dateStr, fallbackDate) {
  const d = dateStr ? parseISO(dateStr) : (fallbackDate ? new Date(fallbackDate) : null);
  if (!d || !isValid(d)) return null;
  return format(d, 'yyyy-MM');
}

export default function Relatorios() {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const [selectedMonth, setSelectedMonth] = useState('todos');
  const [activeCategories, setActiveCategories] = useState(['financas', 'compras', 'despesas']);

  const { data: financasRaw = [] } = useQuery({ queryKey: ['financas'], queryFn: () => base44.entities.Financa.list() });
  const { data: comprasRaw = [] } = useQuery({ queryKey: ['compras'], queryFn: () => base44.entities.Compra.list() });
  const { data: despesasRaw = [] } = useQuery({ queryKey: ['despesas'], queryFn: () => base44.entities.Despesa.list() });

  // Build monthly aggregation
  const monthlyData = useMemo(() => {
    const months = {};

    const ensure = (key) => {
      if (!months[key]) months[key] = { month: key, financas: 0, compras: 0, despesas: 0 };
    };

    financasRaw.forEach(r => {
      const key = getMonthKey(r.data, r.created_date);
      if (!key) return;
      ensure(key);
      months[key].financas += r.valor || 0;
    });

    comprasRaw.forEach(r => {
      const key = getMonthKey(r.data, r.created_date);
      if (!key) return;
      ensure(key);
      months[key].compras += r.valor || 0;
    });

    despesasRaw.forEach(r => {
      const key = getMonthKey(r.data, r.created_date);
      if (!key) return;
      ensure(key);
      months[key].despesas += r.valor || 0;
    });

    return Object.values(months)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(row => ({ ...row, saldo: (row.financas + row.compras) - row.despesas }));
  }, [financasRaw, comprasRaw, despesasRaw]);

  // Filter by selected year/month
  const filteredData = useMemo(() => {
    return monthlyData.filter(row => {
      const [year, month] = row.month.split('-');
      if (year !== selectedYear) return false;
      if (selectedMonth !== 'todos' && month !== selectedMonth) return false;
      return true;
    });
  }, [monthlyData, selectedYear, selectedMonth]);

  // Summary totals for filtered period
  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, row) => ({
        financas: acc.financas + row.financas,
        compras: acc.compras + row.compras,
        despesas: acc.despesas + row.despesas,
      }),
      { financas: 0, compras: 0, despesas: 0 }
    );
  }, [filteredData]);

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set(monthlyData.map(r => r.month.split('-')[0]));
    years.add(String(CURRENT_YEAR));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [monthlyData]);

  // If the current year has no data yet, default to the most recent year that has data
  const hasAutoSelectedYear = useRef(false);
  useEffect(() => {
    if (hasAutoSelectedYear.current || monthlyData.length === 0) return;
    const yearsWithData = [...new Set(monthlyData.map(r => r.month.split('-')[0]))].sort((a, b) => b.localeCompare(a));
    if (yearsWithData.length > 0 && !yearsWithData.includes(String(CURRENT_YEAR))) {
      setSelectedYear(yearsWithData[0]);
    }
    hasAutoSelectedYear.current = true;
  }, [monthlyData]);

  const exportToExcel = () => {
    // Only export records matching the currently selected year/month filter,
    // so the exported totals match what's shown on screen.
    const matchesFilter = (r) => {
      const key = getMonthKey(r.data, r.created_date);
      if (!key) return false;
      const [year, month] = key.split('-');
      if (year !== selectedYear) return false;
      if (selectedMonth !== 'todos' && month !== selectedMonth) return false;
      return true;
    };

    const rows = [];

    // Header
    rows.push(['Tipo', 'Data', 'Nick/Descrição', 'Produto/GC', 'Guilda/Enviado Por', 'Valor (R$)']);

    const sortedFinancas = [...financasRaw].filter(matchesFilter).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    sortedFinancas.forEach(r => {
      rows.push(['Doação', r.data || format(new Date(r.created_date), 'yyyy-MM-dd'), r.nick || '', r.gc || '', r.enviado_por || '', r.valor || 0]);
    });

    const sortedCompras = [...comprasRaw].filter(matchesFilter).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    sortedCompras.forEach(r => {
      rows.push(['Pacote Guilda', r.data || format(new Date(r.created_date), 'yyyy-MM-dd'), r.nick || '', r.produto || '', r.guilda || '', r.valor || 0]);
    });

    const sortedDespesas = [...despesasRaw].filter(matchesFilter).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    sortedDespesas.forEach(r => {
      rows.push(['Despesa', r.data || format(new Date(r.created_date), 'yyyy-MM-dd'), r.descricao || '', r.categoria || '', r.observacao || '', -(r.valor || 0)]);
    });

    // Convert to CSV (UTF-8 BOM for Excel compatibility)
    const csvContent = '\uFEFF' + rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `glitnir-financas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <FinanceGuardRole>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Análise financeira mensal</p>
        </div>
        <Button onClick={exportToExcel} variant="outline" className="gap-2 border-green-500/40 text-green-400 hover:bg-green-500/10 hover:text-green-300">
          <Download className="w-4 h-4" />
          Exportar Excel
        </Button>
      </div>

      <ReportFilters
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        activeCategories={activeCategories}
        onToggleCategory={(cat) =>
          setActiveCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
          )
        }
        availableYears={availableYears}
      />

      <ReportSummaryCards totals={totals} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <MonthlyEvolutionChart data={filteredData} activeCategories={activeCategories} />
        <CategoryComparisonChart data={filteredData} activeCategories={activeCategories} />
      </div>

      <PlayerStatsReport selectedYear={selectedYear} />
    </div>
    </FinanceGuardRole>
  );
}