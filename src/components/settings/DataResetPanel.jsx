import React, { useState } from 'react';
import { AlertTriangle, Download, Loader2, Trash2 } from 'lucide-react';

import { supabase } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const CATEGORIES = [
  { key: 'financas', label: 'Doações', table: 'financas', scoped: true },
  { key: 'compras', label: 'Pacotes Guildas (histórico)', table: 'compras', scoped: true },
  { key: 'despesas', label: 'Despesas', table: 'despesas', scoped: false },
  { key: 'players', label: 'Players', table: 'players', scoped: true },
  { key: 'banidos', label: 'Banidos', table: 'banidos', scoped: true },
  { key: 'logs', label: 'Logs de segurança', table: 'security_logs', scoped: false },
];

const SERVER_LABELS = { server_1: 'Server 1', server_2: 'Server 2', todos: 'Todos os servidores' };

export default function DataResetPanel() {
  const [selected, setSelected] = useState({});
  const [target, setTarget] = useState('todos');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [backup, setBackup] = useState(null);

  const availableCategories = CATEGORIES.filter((category) => category.scoped || target === 'todos');
  const selectedCategories = availableCategories.filter((category) => selected[category.key]);
  const allSelected = availableCategories.length > 0 && availableCategories.every((category) => selected[category.key]);
  const hasSelection = selectedCategories.length > 0;
  const confirmationText = `APAGAR ${target === 'todos' ? 'TODOS' : target === 'server_1' ? 'SERVER 1' : 'SERVER 2'}`;
  const toggleAll = () => { setBackup(null); setSelected(allSelected ? {} : Object.fromEntries(availableCategories.map((category) => [category.key, true]))); };

  const exportBackup = async () => {
    setLoading(true); setError(''); setBackup(null); setResult('');
    try {
      if (!supabase) throw new Error('O reset exige conexão com o Supabase.');
      const data = [];
      for (const category of selectedCategories) {
        const records = []; let cursor = null;
        while (true) {
          let query = supabase.from(category.table).select('*').order('id').limit(500);
          if (category.scoped && target !== 'todos') query = query.eq('server', target);
          if (cursor) query = query.gt('id', cursor);
          const { data: page, error: readError } = await query;
          if (readError) throw new Error(`Falha ao gerar backup de ${category.label}: ${readError.message}`);
          if (!page.length) break;
          records.push(...page); cursor = page[page.length - 1].id;
        }
        data.push({ category: category.label, table: category.table, records });
      }
      const snapshot = { generatedAt: new Date().toISOString(), target, data };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = `glitnir-backup-${target}-${snapshot.generatedAt.slice(0, 10)}.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackup(snapshot);
    } catch (caught) { setError(caught.message || 'Falha ao gerar backup.'); }
    finally { setLoading(false); }
  };

  const reset = async () => {
    if (confirmation !== confirmationText || !backup || !supabase) return;
    setLoading(true); setError(''); setResult('');
    try {
      const records = Object.fromEntries(backup.data.map((item) => [item.table, item.records.map((record) => record.id)]));
      const { data, error: resetError } = await supabase.rpc('reset_system_data', { p_target: backup.target, p_records: records });
      if (resetError) throw resetError;
      setResult(`${data.total} registros apagados em ${SERVER_LABELS[target]}.`);
      setBackup(null);
      setSelected({});
      setConfirmOpen(false);
      setConfirmation('');
    } catch (caught) {
      setBackup(null); setConfirmOpen(false);
      setError(`Não foi possível confirmar o resultado: ${caught.message || 'falha no reset.'} Confira os dados e gere um novo backup antes de tentar novamente.`);
    } finally {
      setLoading(false);
    }
  };

  return <div className="w-full space-y-6">
    <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><h3 className="text-base font-semibold text-foreground">Resetar dados do sistema</h3></div>
    <p className="text-sm text-muted-foreground">Escolha o servidor, baixe o backup e confirme a exclusão. Apenas os registros incluídos no backup serão apagados. Doações VIP apagadas serão desvinculadas das entregas, cujo histórico será preservado. Players apagados também serão desvinculados dos históricos relacionados.</p>
    <div className="max-w-xs space-y-2">
      <Label>Servidor a resetar</Label>
      <Select disabled={loading} value={target} onValueChange={(value) => { setTarget(value); setBackup(null); setResult(''); if (value !== 'todos') setSelected((current) => ({ ...current, logs: false, despesas: false })); }}>
        <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="server_1">Server 1</SelectItem><SelectItem value="server_2">Server 2</SelectItem><SelectItem value="todos">Todos os servidores</SelectItem></SelectContent>
      </Select>
    </div>
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-3 border-b border-border bg-secondary/50 px-4 py-3"><Checkbox id="select-all" disabled={loading} checked={allSelected} onCheckedChange={toggleAll} /><label htmlFor="select-all" className="cursor-pointer select-none text-sm font-semibold">Selecionar tudo</label></div>
      {CATEGORIES.map((category) => {
        const enabled = !loading && (category.scoped || target === 'todos');
        const toggle = () => { if (enabled) { setBackup(null); setResult(''); setSelected((current) => ({ ...current, [category.key]: !current[category.key] })); } };
        return <div key={category.key} className={`flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0 ${enabled ? 'hover:bg-secondary/20' : 'opacity-50'}`}>
          <Checkbox id={category.key} disabled={!enabled} checked={!!selected[category.key]} onCheckedChange={toggle} />
          <label htmlFor={category.key} className={`select-none text-sm text-foreground ${enabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}>{category.label}{!category.scoped && <span className="ml-2 text-xs text-muted-foreground">(global — somente em Todos)</span>}</label>
        </div>;
      })}
    </div>
    {result && <p className="text-sm font-medium text-green-400">{result}</p>}
    {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    {backup && <p className="text-sm text-muted-foreground">Backup preparado: {backup.data.reduce((sum, item) => sum + item.records.length, 0)} registros. Novos registros não serão apagados.</p>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!hasSelection || loading} onClick={exportBackup}><Download className="mr-2 h-4 w-4" />Baixar backup</Button><Button variant="destructive" disabled={!hasSelection || !backup || loading} onClick={() => { setConfirmation(''); setConfirmOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Apagar selecionados ({selectedCategories.length})</Button></div>
    <AlertDialog open={confirmOpen} onOpenChange={(open) => { if (!loading) setConfirmOpen(open); }}>
      <AlertDialogContent className="border-border bg-card"><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Você apagará os dados selecionados de <strong>{SERVER_LABELS[target]}</strong>. Digite <strong>{confirmationText}</strong> para confirmar.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2"><Label>Confirmação</Label><Input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} placeholder={confirmationText} /></div><AlertDialogFooter><AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={loading || confirmation !== confirmationText} onClick={(event) => { event.preventDefault(); reset(); }} className="bg-destructive hover:bg-destructive/90">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Apagar permanentemente</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}
