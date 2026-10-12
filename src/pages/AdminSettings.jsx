import React, { useState } from 'react';

import { useAuth } from '@/lib/AuthContext';
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
        <p className="mt-1 text-muted-foreground">Gerencie a tabela de Moeda Glitnir e os dados do sistema.</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-2">
          <TabsTrigger value="gc">Tabela de Moeda Glitnir</TabsTrigger>
          <TabsTrigger value="reset" className="text-destructive">Reset de dados</TabsTrigger>
        </TabsList>
        <TabsContent value="gc"><div className="rounded-xl border border-border bg-card p-4 sm:p-6"><GcTabelaEditor /></div></TabsContent>
        <TabsContent value="reset"><div className="rounded-xl border border-destructive/30 bg-card p-4 sm:p-6"><DataResetPanel /></div></TabsContent>
      </Tabs>
    </div>
  );
}
