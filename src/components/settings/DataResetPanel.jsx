import React, { useState } from 'react';
import { AlertTriangle, Download, Loader2, Trash2 } from 'lucide-react';

import { base44 } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const CATEGORIES = [
  { key: 'financas', label: 'Doações', entity: 'Financa', scoped: true },
  { key: 'compras', label: 'Pacotes Guildas (histórico)', entity: 'Compra', scoped: true },
  { key: 'despesas', label: 'Despesas', entity: 'Despesa', scoped: true },
  { key: 'players', label: 'Players', entity: 'Player', scoped: true },
  { key: 'banidos', label: 'Banidos', entity: 'Banido', scoped: true },
  { key: 'logs', label: 'Logs de segurança', entity: 'SecurityLog', scoped: false },
];

const SERVER_LABELS = { server_1: 'Server 1', server_2: 'Server 2', todos: 'Todos os servidores' };

export default function DataResetPanel() {
  const [selected, setSelected] = useState({});
  const [target, setTarget] = useState('todos');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const availableCategories = CATEGORIES.filter((category) => category.scoped || target === 'todos');
  const selectedCategories = availableCategories.filter((category) => selected[category.key]);
  const allSelected = availableCategories.length > 0 && availableCategories.every((category) => selected[category.key]);
  const hasSelection = selectedCategories.length > 0;
  const confirmationText = `APAGAR ${target === 'todos' ? 'TODOS' : target === 'server_1' ? 'SERVER 1' : 'SERVER 2'}`;
  const criteriaFor = (category) => (category.scoped && target !== 'todos' ? { server: target } : {});

  const selectedData = async () => Promise.all(selectedCategories.map(async (category) => ({
    category: category.label,
    records: (await base44.entities[category.entity].list()).filter((record) => !category.scoped || target === 'todos' || record.server === target),
  })));

  const toggleAll = () => setSelected(allSelected ? {} : Object.fromEntries(availableCategories.map((category) => [category.key, true])));

  const exportBackup = async () => {
    const data = await selectedData();
    const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), target: SERVER_LABELS[target], data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `glitnir-backup-${target}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reset = async () => {
    if (confirmation !== confirmationText) return;
    setLoading(true);
    try {
      const data = await selectedData();
      for (const category of selectedCategories) await base44.entities[category.entity].bulkDelete(criteriaFor(category));
      const total = data.reduce((sum, item) => sum + item.records.length, 0);
      setResult(`${total} registros apagados em ${SERVER_LABELS[target]}.`);
      setSelected({});
      setConfirmOpen(false);
      setConfirmation('');
    } finally {
      setLoading(false);
    }
  };

  return <div className="w-full space-y-6">
    <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><h3 className="text-base font-semibold text-foreground">Resetar dados do sistema</h3></div>
    <p className="text-sm text-muted-foreground">Escolha o servidor, faça o backup e confirme a exclusão. Esta ação não pode ser desfeita.</p>
    <div className="max-w-xs space-y-2">
      <Label>Servidor a resetar</Label>
      <Select value={target} onValueChange={(value) => { setTarget(value); if (value !== 'todos') setSelected((current) => ({ ...current, logs: false })); }}>
        <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="server_1">Server 1</SelectItem><SelectItem value="server_2">Server 2</SelectItem><SelectItem value="todos">Todos os servidores</SelectItem></SelectContent>
      </Select>
    </div>
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-3 border-b border-border bg-secondary/50 px-4 py-3"><Checkbox id="select-all" checked={allSelected} onCheckedChange={toggleAll} /><label htmlFor="select-all" className="cursor-pointer select-none text-sm font-semibold">Selecionar tudo</label></div>
      {CATEGORIES.map((category) => {
        const enabled = category.scoped || target === 'todos';
        const toggle = () => enabled && setSelected((current) => ({ ...current, [category.key]: !current[category.key] }));
        return <div key={category.key} onClick={toggle} className={`flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0 ${enabled ? 'cursor-pointer hover:bg-secondary/20' : 'cursor-not-allowed opacity-50'}`}>
          <Checkbox id={category.key} disabled={!enabled} checked={!!selected[category.key]} onCheckedChange={toggle} onClick={(event) => event.stopPropagation()} />
          <label htmlFor={category.key} className={`select-none text-sm text-foreground ${enabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}>{category.label}{!category.scoped && <span className="ml-2 text-xs text-muted-foreground">(global — somente em Todos)</span>}</label>
        </div>;
      })}
    </div>
    {result && <p className="text-sm font-medium text-green-400">{result}</p>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!hasSelection || loading} onClick={exportBackup}><Download className="mr-2 h-4 w-4" />Baixar backup</Button><Button variant="destructive" disabled={!hasSelection || loading} onClick={() => { setConfirmation(''); setConfirmOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Apagar selecionados ({selectedCategories.length})</Button></div>
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent className="border-border bg-card"><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Você apagará os dados selecionados de <strong>{SERVER_LABELS[target]}</strong>. Digite <strong>{confirmationText}</strong> para confirmar.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2"><Label>Confirmação</Label><Input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} placeholder={confirmationText} /></div><AlertDialogFooter><AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={loading || confirmation !== confirmationText} onClick={(event) => { event.preventDefault(); reset(); }} className="bg-destructive hover:bg-destructive/90">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Apagar permanentemente</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}
