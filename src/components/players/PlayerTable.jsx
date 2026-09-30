import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, AlertTriangle, GripVertical } from 'lucide-react';
import PlayerEditRow from './PlayerEditRow';

const statusStyles = {
  ativo: 'bg-green-500/15 text-green-400 border-green-500/30',
  inativo: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  banido: 'bg-red-500/15 text-red-400 border-red-500/30',
  suspenso: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
};

export default function PlayerTable({ players, onUpdate, onDelete, onReorder }) {
  const [editingId, setEditingId] = useState(null);

  const handleSave = async (id, data) => {
    try {
      await onUpdate(id, data);
      setEditingId(null);
    } catch (error) {
      console.error('Erro ao atualizar player:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await onDelete(id);
    } catch (error) {
      console.error('Erro ao excluir player:', error);
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(players);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onReorder(reordered);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Nick</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Steam ID</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Guilda</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Obs</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="players" isDropDisabled={editingId !== null}>
              {(provided) => (
                <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                  {players.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        Nenhum player encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    players.map((player, index) => {
                      if (editingId === player.id) {
                        return (
                          <PlayerEditRow
                            key={player.id}
                            player={player}
                            onSave={handleSave}
                            onCancel={() => setEditingId(null)}
                          />
                        );
                      }

                      const rowStyle = {};
                      if (player.duplicado) {
                        rowStyle.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                        rowStyle.borderLeft = '4px solid #ef4444';
                      } else if (player.cor) {
                        rowStyle.backgroundColor = `${player.cor}59`;
                        rowStyle.borderLeft = `4px solid ${player.cor}`;
                      }

                      return (
                        <Draggable key={player.id} draggableId={player.id} index={index}>
                          {(dragProvided, snapshot) => (
                            <TableRow
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className="hover:brightness-110 transition-all"
                              style={{ ...rowStyle, ...dragProvided.draggableProps.style, opacity: snapshot.isDragging ? 0.8 : 1 }}
                            >
                              <TableCell {...dragProvided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-4 h-4 text-muted-foreground" />
                              </TableCell>
                              <TableCell className="font-medium text-foreground">
                                <div className="flex items-center gap-2">
                                  {player.nick}
                                  {player.duplicado && (
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm text-muted-foreground">{player.steamid}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusStyles[player.status] || statusStyles.ativo}>
                                  {player.status || 'ativo'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{player.guilda || '-'}</TableCell>
                              <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                                {player.observacao || '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(player.id)}>
                                    <Pencil className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(player.id)}>
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Draggable>
                      );
                    })
                  )}
                  {provided.placeholder}
                </TableBody>
              )}
            </Droppable>
          </DragDropContext>
        </Table>
      </div>
    </div>
  );
}
