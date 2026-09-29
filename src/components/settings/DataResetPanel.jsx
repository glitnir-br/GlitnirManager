import React, { useState } from 'react';
import { base44 } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CATEGORIES = [
  { key: 'financas',  label: 'Doações / GC',         entity: 'Financa' },
  { key: 'compras',   label: 'Pacotes de Guildas',    entity: 'Compra' },
  { key: 'despesas',  label: 'Despesas',               entity: 'Despesa' },
  { key: 'players',   label: 'Jogadores',              entity: 'Player' },
  { key: 'banidos',   label: 'Banidos',                entity: 'Banido' },
  { key: 'logs',      label: 'Logs de Segurança',      entity: 'SecurityLog' },
];

export default function DataResetPanel() {
  const [selected, setSelected] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const allSelected = CATEGORIES.every(c => selected[c.key]);

  const toggleAll = () => {
    if (allSelected) {
      setSelected({});
    } else {
      const all = {};
      CATEGORIES.forEach(c => { all[c.key] = true; });
      setSelected(all);
    }
  };

  const toggle = (key) => {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedCategories = CATEGORIES.filter(c => selected[c.key]);
  const hasSelection = selectedCategories.length > 0;

  const handleConfirmedDelete = async () => {
    setLoading(true);
    setResult(null);
    let totalDeleted = 0;

    for (const cat of selectedCategories) {
      const records = await base44.entities[cat.entity].list();
      for (const record of records) {
        await base44.entities[cat.entity].delete(record.id);
        totalDeleted++;
      }
    }

    setLoading(false);
    setConfirmOpen(false);
    setSelected({});
    setResult(`${totalDeleted} registros apagados com sucesso.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <h3 className="text-base font-semibold text-foreground">Resetar Dados do Sistema</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Selecione as categorias que deseja apagar permanentemente. <span className="text-destructive font-medium">Esta ação não pode ser desfeita.</span>
      </p>

      <div className="rounded-lg border border-border overflow-hidden">
        {/* Selecionar tudo */}
        <div className="flex items-center gap-3 px-4 py-3 bg-secondary/50 border-b border-border">
          <Checkbox
            id="select-all"
            checked={allSelected}
            onCheckedChange={toggleAll}
          />
          <label htmlFor="select-all" className="text-sm font-semibold text-foreground cursor-pointer select-none">
            Selecionar Tudo
          </label>
        </div>

        {CATEGORIES.map((cat) => (
          <div
            key={cat.key}
            className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-secondary/20 cursor-pointer"
            onClick={() => toggle(cat.key)}
          >
            <Checkbox
              id={cat.key}
              checked={!!selected[cat.key]}
              onCheckedChange={() => toggle(cat.key)}
              onClick={(e) => e.stopPropagation()}
            />
            <label htmlFor={cat.key} className="text-sm text-foreground cursor-pointer select-none">
              {cat.label}
            </label>
          </div>
        ))}
      </div>

      {result && (
        <p className="text-sm text-green-400 font-medium">{result}</p>
      )}

      <Button
        variant="destructive"
        disabled={!hasSelection || loading}
        onClick={() => setConfirmOpen(true)}
        className="gap-2"
      >
        <Trash2 className="w-4 h-4" />
        Apagar Selecionados ({selectedCategories.length})
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Você está prestes a apagar permanentemente os dados de:
              <ul className="mt-2 space-y-1">
                {selectedCategories.map(c => (
                  <li key={c.key} className="text-foreground font-medium">• {c.label}</li>
                ))}
              </ul>
              <span className="block mt-3 text-destructive font-semibold">Esta ação não pode ser desfeita!</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedDelete}
              disabled={loading}
              className="bg-destructive hover:bg-destructive/90 gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {loading ? 'Apagando...' : 'Confirmar e Apagar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
