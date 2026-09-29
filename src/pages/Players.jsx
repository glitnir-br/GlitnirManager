import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';
import PlayerTable from '@/components/players/PlayerTable';
import PlayerFilters from '@/components/players/PlayerFilters';
import AddPlayerDialog from '@/components/players/AddPlayerDialog';

async function checkDuplicates(players, current) {
  const isDuplicate = players.some(
    p => p.id !== current.id && (p.nick === current.nick || p.steamid === current.steamid)
  );
  return isDuplicate;
}

export default function Players() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [guildFilter, setGuildFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const isDup = await checkDuplicates(players, { id: null, ...data });
      const newPlayer = await base44.entities.Player.create({ ...data, duplicado: isDup });
      // Also mark existing players as duplicate if they match
      if (isDup) {
        const matches = players.filter(p => p.nick === data.nick || p.steamid === data.steamid);
        for (const match of matches) {
          if (!match.duplicado) {
            await base44.entities.Player.update(match.id, { duplicado: true });
          }
        }
      }
      return newPlayer;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const isDup = await checkDuplicates(players, { id, ...data });
      await base44.entities.Player.update(id, { ...data, duplicado: isDup });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
  });

  const reorderMutation = useMutation({
    mutationFn: (updates) => base44.entities.Player.bulkUpdate(updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
  });

  const guildas = useMemo(() => {
    const set = new Set(players.map(p => p.guilda).filter(Boolean));
    return [...set].sort();
  }, [players]);

  const sortedPlayers = useMemo(() => {
    const ordered = players.filter(p => p.ordem !== undefined && p.ordem !== null);
    const unordered = players.filter(p => p.ordem === undefined || p.ordem === null)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    ordered.sort((a, b) => a.ordem - b.ordem);
    return [...unordered, ...ordered];
  }, [players]);

  const filtered = useMemo(() => {
    return sortedPlayers.filter(p => {
      const matchesSearch = !search ||
        p.nick?.toLowerCase().includes(search.toLowerCase()) ||
        p.steamid?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'duplicado' ? p.duplicado : p.status === statusFilter);
      const matchesGuild = guildFilter === 'all' || p.guilda === guildFilter;
      return matchesSearch && matchesStatus && matchesGuild;
    });
  }, [sortedPlayers, search, statusFilter, guildFilter]);

  const handleReorder = (reorderedList) => {
    const updates = reorderedList.map((p, idx) => ({ id: p.id, ordem: idx }));
    reorderMutation.mutate(updates);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Players</h1>
          <p className="text-muted-foreground text-sm mt-1">{players.length} jogadores cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const content = players
                .filter(p => p.nick)
                .map(p => p.nick)
                .join('\n');
              const blob = new Blob([content], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'nomes.txt';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Nicks
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const content = players
                .filter(p => p.steamid)
                .map(p => p.steamid)
                .join('\n');
              const blob = new Blob([content], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'whitelist_steamids.txt';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            SteamIDs
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Player
          </Button>
        </div>
      </div>

      <PlayerFilters
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        guildFilter={guildFilter}
        setGuildFilter={setGuildFilter}
        guildas={guildas}
      />

      <PlayerTable
        players={filtered}
        onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
        onDelete={(id) => deleteMutation.mutateAsync(id)}
        onReorder={handleReorder}
      />

      <AddPlayerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={(data) => createMutation.mutateAsync(data)}
      />
    </div>
  );
}