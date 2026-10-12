import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import PasswordProtectedArea from '@/components/PasswordProtectedArea';
import FinancialPasswordField from '@/components/settings/FinancialPasswordField';
import GcTabelaEditor from '@/components/settings/GcTabelaEditor';
import DataResetPanel from '@/components/settings/DataResetPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminSettings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('password');
  if (user?.role !== 'adm_principal') return <div className="flex h-64 items-center justify-center"><p className="text-muted-foreground">Acesso restrito a ADM Principal.</p></div>;

  return <PasswordProtectedArea title="Configurações Administrativas"><div className="w-full min-w-0 space-y-6"><div><h1 className="text-3xl font-bold text-foreground">Configurações de Administrador</h1><p className="mt-1 text-muted-foreground">Gerencie senhas, tabela de Moeda Glitnir e dados do sistema.</p></div><Tabs value={activeTab} onValueChange={setActiveTab} className="w-full"><TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3"><TabsTrigger value="password">Senhas de acesso</TabsTrigger><TabsTrigger value="gc">Tabela de Moeda Glitnir</TabsTrigger><TabsTrigger value="reset" className="text-destructive">Reset de dados</TabsTrigger></TabsList><TabsContent value="password"><div className="space-y-6 rounded-xl border border-border bg-card p-4 sm:p-6"><div><h2 className="mb-2 text-xl font-semibold text-foreground">Senhas de acesso aos módulos</h2><p className="mb-6 text-sm text-muted-foreground">Defina as senhas de Doações/GC e Despesas. Senha padrão: <span className="font-semibold text-primary">Pituca00</span></p><div className="space-y-6"><FinancialPasswordField title="Doações/GC" module="doacoes" /><div className="border-t border-border pt-6"><FinancialPasswordField title="Despesas" module="despesas" /></div><div className="border-t border-border pt-6"><FinancialPasswordField title="Configurações" module="configuracoes" /></div><div className="border-t border-border pt-6"><FinancialPasswordField title="Segurança" module="seguranca" /></div></div></div></div></TabsContent><TabsContent value="gc"><div className="rounded-xl border border-border bg-card p-4 sm:p-6"><GcTabelaEditor /></div></TabsContent><TabsContent value="reset"><div className="rounded-xl border border-destructive/30 bg-card p-4 sm:p-6"><DataResetPanel /></div></TabsContent></Tabs></div></PasswordProtectedArea>;
}
