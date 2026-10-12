import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, ArrowUpDown } from 'lucide-react';

export default function PlayerFilters({ search, setSearch, statusFilter, setStatusFilter, guildFilter, setGuildFilter, guildas, sortOrder, setSortOrder }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por personagem ou Steam ID..."
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
      <Select value={sortOrder} onValueChange={setSortOrder}>
        <SelectTrigger className="w-full sm:w-52 bg-secondary">
          <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Organizar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="manual">Ordem manual</SelectItem>
          <SelectItem value="character_asc">Personagem: A–Z</SelectItem>
          <SelectItem value="character_desc">Personagem: Z–A</SelectItem>
          <SelectItem value="steamid_asc">Steam ID: crescente</SelectItem>
          <SelectItem value="steamid_desc">Steam ID: decrescente</SelectItem>
          <SelectItem value="newest">Cadastro: mais recentes</SelectItem>
          <SelectItem value="oldest">Cadastro: mais antigos</SelectItem>
          <SelectItem value="whitelist">Whitelist primeiro</SelectItem>
          <SelectItem value="status">Status</SelectItem>
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
