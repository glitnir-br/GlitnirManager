import React, { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

export default function PlayerEditRow({ player, onSave, onCancel, rowRef, draggableProps }) {
  const [form, setForm] = useState({
    nick: player.nick || '',
    steamid: player.steamid || '',
    status: player.status || 'ativo',
    guilda: player.guilda || '',
    observacao: player.observacao || '',
    cor: player.cor || '',
  });

  return (
    <TableRow ref={rowRef} {...draggableProps} className="bg-primary/5">
      <TableCell></TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            type="color"
            value={form.cor || '#a855f7'}
            onChange={(e) => setForm({ ...form, cor: e.target.value })}
            className="h-8 w-8 p-1 bg-secondary cursor-pointer shrink-0"
            title="Cor do player"
          />
          <Input
            value={form.nick}
            onChange={(e) => setForm({ ...form, nick: e.target.value })}
            className="h-8 bg-secondary"
          />
        </div>
      </TableCell>
      <TableCell>
        <Input
          value={form.steamid}
          onChange={(e) => setForm({ ...form, steamid: e.target.value })}
          className="h-8 bg-secondary font-mono text-sm"
        />
      </TableCell>
      <TableCell>
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
          <SelectTrigger className="h-8 bg-secondary w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
            <SelectItem value="banido">Banido</SelectItem>
            <SelectItem value="suspenso">Suspenso</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          value={form.guilda}
          onChange={(e) => setForm({ ...form, guilda: e.target.value })}
          className="h-8 bg-secondary"
        />
      </TableCell>
      <TableCell>
        <Input
          value={form.observacao}
          onChange={(e) => setForm({ ...form, observacao: e.target.value })}
          className="h-8 bg-secondary"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSave(player.id, form)}>
            <Check className="w-4 h-4 text-green-400" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel}>
            <X className="w-4 h-4 text-red-400" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
