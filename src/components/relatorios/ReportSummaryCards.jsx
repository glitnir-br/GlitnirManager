import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const fmt = (v) => `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtSigned = (v) => `${v < 0 ? '-' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function ReportSummaryCards({ totals }) {
  const arrecadacao = totals.financas + totals.compras;
  const despesasTotal = totals.despesas;
  const liquido = arrecadacao - despesasTotal;
  const isNegativo = liquido < 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

      {/* ARRECADAÇÃO */}
      <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Arrecadação</p>
        <p className="text-xs text-muted-foreground mb-1">Todo dinheiro que entra</p>
        <div className="border-t border-purple-500/20 pt-3 mt-2">
          <p className="text-xs text-muted-foreground uppercase mb-1">Total:</p>
          <p className="text-2xl font-bold font-mono text-purple-400">{fmt(arrecadacao)}</p>
        </div>
        <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
          <span>Doações: <span className="text-purple-300 font-mono">{fmt(totals.financas)}</span></span>
          <span>Pacotes: <span className="text-yellow-400 font-mono">{fmt(totals.compras)}</span></span>
        </div>
      </div>

      {/* DESPESAS */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Despesas</p>
        <p className="text-xs text-muted-foreground mb-1">Todo dinheiro que sai</p>
        <div className="border-t border-red-500/20 pt-3 mt-2">
          <p className="text-xs text-muted-foreground uppercase mb-1">Total:</p>
          <p className="text-2xl font-bold font-mono text-red-400">{fmt(despesasTotal)}</p>
        </div>
        
      </div>

      {/* LÍQUIDO */}
      <div className={`rounded-xl border p-5 flex flex-col ${isNegativo ? 'border-red-500/50 bg-red-500/10' : 'border-green-500/30 bg-green-500/10'}`}>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Líquido</p>
        <p className="text-xs text-muted-foreground mb-1">Valor que sobra</p>
        <div className={`border-t pt-3 mt-2 flex items-center justify-between ${isNegativo ? 'border-red-500/20' : 'border-green-500/20'}`}>
          <div>
            <p className="text-xs text-muted-foreground uppercase mb-1">Total:</p>
            <p className={`text-2xl font-bold font-mono ${isNegativo ? 'text-red-400' : 'text-green-400'}`}>
              {fmtSigned(liquido)}
            </p>
          </div>
          {isNegativo
            ? <TrendingDown className="w-8 h-8 text-red-400 opacity-60" />
            : <TrendingUp className="w-8 h-8 text-green-400 opacity-60" />
          }
        </div>
      </div>

    </div>
  );
}
