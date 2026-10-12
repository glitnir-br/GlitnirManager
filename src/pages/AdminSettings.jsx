import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Activity, CheckCircle2, Database, Server } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/dbClient';
import GcTabelaEditor from '@/components/settings/GcTabelaEditor';
import DataResetPanel from '@/components/settings/DataResetPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminSettings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('gc');

  if (user?.role !== 'adm_principal') {
    return <div className="flex h-64 items-center justify-center"><p className="text-muted-foreground">Acesso restrito a ADM Principal.</p></div>;
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações de Administrador</h1>
        <p className="mt-1 text-muted-foreground">Gerencie a tabela de Moeda Glitnir, integrações e dados do sistema.</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
          <TabsTrigger value="gc">Tabela de Moeda Glitnir</TabsTrigger>
          <TabsTrigger value="health">Integrações</TabsTrigger>
          <TabsTrigger value="reset" className="text-destructive">Reset de dados</TabsTrigger>
        </TabsList>
        <TabsContent value="gc"><div className="rounded-xl border border-border bg-card p-4 sm:p-6"><GcTabelaEditor /></div></TabsContent>
        <TabsContent value="health"><IntegrationHealth /></TabsContent>
        <TabsContent value="reset"><div className="rounded-xl border border-destructive/30 bg-card p-4 sm:p-6"><DataResetPanel /></div></TabsContent>
      </Tabs>
    </div>
  );
}

function IntegrationHealth() {
  const { data: players = [] } = useQuery({ queryKey: ['settings-health', 'players'], queryFn: () => base44.entities.Player.list() });
  const { data: banidos = [] } = useQuery({ queryKey: ['settings-health', 'banidos'], queryFn: () => base44.entities.Banido.list() });
  const latest = (records, field, server) => records.filter((item) => item.server === server).map((item) => item[field]).filter(Boolean).sort().at(-1);
  const formatSync = (value) => value ? format(new Date(value), 'dd/MM/yyyy HH:mm') : 'Nunca sincronizado';
  return <div className="space-y-4"><div className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-3"><Database className="h-5 w-5 text-green-400" /><div><h3 className="font-semibold text-foreground">Supabase</h3><p className="text-sm text-green-400">Conexão configurada no cliente</p></div></div></div><div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{['server_1', 'server_2'].map((server) => <div key={server} className="rounded-xl border border-border bg-card p-5"><div className="mb-4 flex items-center gap-2"><Server className="h-5 w-5 text-primary" /><h3 className="font-semibold text-foreground">{server === 'server_1' ? 'Server 1' : 'Server 2'}</h3></div><div className="space-y-2 text-sm"><p className="flex items-center gap-2 text-muted-foreground"><Activity className="h-4 w-4 text-green-400" />Whitelist: <span className="text-foreground">{formatSync(latest(players, 'whitelist_synced_at', server))}</span></p><p className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-red-400" />Banidos: <span className="text-foreground">{formatSync(latest(banidos, 'banlist_synced_at', server))}</span></p></div></div>)}</div><p className="text-xs text-muted-foreground">O painel informa a última sincronização concluída com o Pterodactyl. Use “Sincronizar servidores” no Dashboard para atualizar os dados.</p></div>;
}
