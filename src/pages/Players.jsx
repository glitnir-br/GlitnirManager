import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';
import PlayerTable from '@/components/players/PlayerTable';
import PlayerFilters from '@/components/players/PlayerFilters';
import AddPlayerDialog from '@/components/players/AddPlayerDialog';
import { useServer } from '@/lib/ServerContext';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/dbClient';
import { RefreshCw } from 'lucide-react';

async function checkDuplicates(players, current) {
  const isDuplicate = players.some(
    p => p.id !== current.id && p.steamid === current.steamid
  );
  return isDuplicate;
}

export default function Players() {
  const { server, serverLabel } = useServer();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [guildFilter, setGuildFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('character_asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const queryClient = useQueryClient();

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['players', server],
    queryFn: () => base44.entities.Player.filter({ server }),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const isDup = await checkDuplicates(players, { id: null, ...data });
      const newPlayer = await base44.entities.Player.create({ ...data, server, duplicado: isDup });
      // Also mark existing players as duplicate if they match
      if (isDup) {
        const matches = players.filter(p => p.steamid === data.steamid);
        for (const match of matches) {
          if (!match.duplicado) {
            await base44.entities.Player.update(match.id, { duplicado: true });
          }
        }
      }
      return newPlayer;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players', server] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const isDup = await checkDuplicates(players, { id, ...data });
      await base44.entities.Player.update(id, { ...data, duplicado: isDup });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players', server] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players', server] }),
  });

  const reorderMutation = useMutation({
    mutationFn: (updates) => base44.entities.Player.bulkUpdate(updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players', server] }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error('A sincronização exige conexão com o Supabase.');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão expirada. Entre novamente no sistema.');

      const response = await fetch('/api/sync-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ server }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao sincronizar a whitelist.');
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['players', server] });
      setSyncMessage(`${result.whitelist} na whitelist · ${result.created} novos · ${result.guildAssignments || 0} com guilda · ${result.withoutCharacter} sem personagem`);
    },
    onError: (error) => setSyncMessage(error.message),
  });

  const guildas = useMemo(() => {
    const set = new Set(players.map(p => p.guilda).filter(Boolean));
    return [...set].sort();
  }, [players]);

  const manuallySortedPlayers = useMemo(() => {
    const ordered = players.filter(p => p.ordem !== undefined && p.ordem !== null);
    const unordered = players.filter(p => p.ordem === undefined || p.ordem === null)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    ordered.sort((a, b) => a.ordem - b.ordem);
    return [...unordered, ...ordered];
  }, [players]);

  const filtered = useMemo(() => {
    const visible = manuallySortedPlayers.filter(p => {
      const matchesSearch = !search ||
        p.personagens?.some((name) => name.toLowerCase().includes(search.toLowerCase())) ||
        p.steamid?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'duplicado' ? p.duplicado : p.status === statusFilter);
      const matchesGuild = guildFilter === 'all' || p.guilda === guildFilter;
      return matchesSearch && matchesStatus && matchesGuild;
    });

    const characterNames = (player) => Array.isArray(player.personagens)
      ? player.personagens.filter((name) => typeof name === 'string' && name.trim())
      : [];
    const firstCharacter = (player) => characterNames(player)[0] || '';
    const isUnnamed = (player) => characterNames(player).length === 0;
    const unnamedLast = (sorter) => (a, b) => Number(isUnnamed(a)) - Number(isUnnamed(b)) || sorter(a, b);
    const sorters = {
      character_asc: unnamedLast((a, b) => firstCharacter(a).localeCompare(firstCharacter(b), 'pt-BR', { sensitivity: 'base' })),
      character_desc: unnamedLast((a, b) => firstCharacter(b).localeCompare(firstCharacter(a), 'pt-BR', { sensitivity: 'base' })),
      steamid_asc: unnamedLast((a, b) => String(a.steamid || '').localeCompare(String(b.steamid || ''))),
      steamid_desc: unnamedLast((a, b) => String(b.steamid || '').localeCompare(String(a.steamid || ''))),
      newest: unnamedLast((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)),
      oldest: unnamedLast((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0)),
      whitelist: unnamedLast((a, b) => Number(b.na_whitelist) - Number(a.na_whitelist) || firstCharacter(a).localeCompare(firstCharacter(b), 'pt-BR')),
      status: unnamedLast((a, b) => String(a.status || '').localeCompare(String(b.status || ''), 'pt-BR') || firstCharacter(a).localeCompare(firstCharacter(b), 'pt-BR')),
    };
    const organized = sortOrder === 'manual' ? visible : [...visible].sort(sorters[sortOrder]);
    const withCharacter = organized.filter((player) => !isUnnamed(player));
    const withoutCharacter = organized.filter(isUnnamed);
    return [...withCharacter, ...withoutCharacter];
  }, [manuallySortedPlayers, search, statusFilter, guildFilter, sortOrder]);

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
          <p className="text-muted-foreground text-sm mt-1">{players.length} jogadores cadastrados no {serverLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['adm_principal', 'administrador'].includes(user?.role) && (
            <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar whitelist'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              const content = players.flatMap(p => p.personagens || []).filter(Boolean).join('\n');
              const blob = new Blob([content], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'personagens.txt';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Personagens
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

      {syncMessage && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${syncMutation.isError ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
          {syncMessage}
        </div>
      )}

      <PlayerFilters
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        guildFilter={guildFilter}
        setGuildFilter={setGuildFilter}
        guildas={guildas}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      <PlayerTable
        players={filtered}
        onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
        onDelete={(id) => deleteMutation.mutateAsync(id)}
        onReorder={handleReorder}
        canReorder={sortOrder === 'manual'}
      />

      <AddPlayerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={(data) => createMutation.mutateAsync(data)}
        server={server}
      />
    </div>
  );
}
