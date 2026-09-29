import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';

export default function PlayerFilters({ search, setSearch, statusFilter, setStatusFilter, guildFilter, setGuildFilter, guildas }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nick ou steamid..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-secondary border-border"
        />
      </div>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-full sm:w-36 bg-secondary">
          <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="ativo">Ativo</SelectItem>
          <SelectItem value="inativo">Inativo</SelectItem>
          <SelectItem value="banido">Banido</SelectItem>
          <SelectItem value="suspenso">Suspenso</SelectItem>
          <SelectItem value="duplicado">Duplicados</SelectItem>
        </SelectContent>
      </Select>
      <Select value={guildFilter} onValueChange={setGuildFilter}>
        <SelectTrigger className="w-full sm:w-36 bg-secondary">
          <SelectValue placeholder="Guilda" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {guildas.map(g => (
            <SelectItem key={g} value={g}>{g}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}