import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Coins } from 'lucide-react';

export default function GcTabelaEditor() {
  const queryClient = useQueryClient();
  const [newReais, setNewReais] = useState('');
  const [newGc, setNewGc] = useState('');

  const { data: tabela = [], isLoading } = useQuery({
    queryKey: ['gcTabela'],
    queryFn: () => base44.entities.GcTabela.list('ordem'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.GcTabela.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gcTabela'] });
      setNewReais('');
      setNewGc('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GcTabela.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gcTabela'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.GcTabela.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gcTabela'] }),
  });

  const handleAdd = () => {
    if (!newReais || !newGc) return;
    createMutation.mutate({
      reais: parseFloat(newReais),
      gc: parseFloat(newGc),
      ordem: tabela.length + 1,
    });
  };

  const handleUpdate = (item, field, value) => {
    updateMutation.mutate({ id: item.id, data: { ...item, [field]: parseFloat(value) || 0 } });
  };

  if (isLoading) return <div className="text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Coins className="w-4 h-4 text-primary" />
        <h3 className="text-base font-semibold text-foreground">Tabela de GC (Moedas Glitnir)</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Edite os valores exibidos na página de Doações/GC. Alterações são salvas ao sair do campo.
      </p>

      <div className="w-full overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50 border-b border-border">
              <th className="text-left px-4 py-2 text-muted-foreground font-medium">Reais (R$)</th>
              <th className="text-left px-4 py-2 text-muted-foreground font-medium">GC</th>
              <th className="w-12 px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tabela.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-6 text-muted-foreground">
                  Nenhum item. Adicione abaixo.
                </td>
              </tr>
            )}
            {tabela.map((item) => (
              <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20">
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    defaultValue={item.reais}
                    onBlur={(e) => handleUpdate(item, 'reais', e.target.value)}
                    className="h-8 w-full bg-secondary font-mono"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    defaultValue={item.gc}
                    onBlur={(e) => handleUpdate(item, 'gc', e.target.value)}
                    className="h-8 w-full bg-secondary font-mono"
                  />
                </td>
                <td className="px-4 py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => deleteMutation.mutate(item.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Adicionar novo */}
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
        <Input
          type="number"
          placeholder="R$ valor"
          value={newReais}
          onChange={(e) => setNewReais(e.target.value)}
          className="h-9 w-full bg-secondary font-mono"
        />
        <Input
          type="number"
          placeholder="GC"
          value={newGc}
          onChange={(e) => setNewGc(e.target.value)}
          className="h-9 w-full bg-secondary font-mono"
        />
        <Button
          onClick={handleAdd}
          disabled={!newReais || !newGc || createMutation.isPending}
          className="h-9 w-full bg-primary hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
