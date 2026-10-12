import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import AuditLog from '@/components/security/AuditLog';
import SecurityNotifications from '@/components/security/SecurityNotifications';
import FinancialPasswordProtection from '@/components/FinancialPasswordProtection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, History, Lock } from 'lucide-react';

export default function SecuritySettings() {
  const { user } = useAuth();
  if (!user) return <div>Carregando...</div>;
  if (user.role !== 'adm_principal') return <div className="flex h-96 flex-col items-center justify-center gap-4"><Lock className="h-12 w-12 text-red-400" /><h2 className="text-2xl font-bold text-foreground">Acesso Restrito</h2><p className="text-muted-foreground">Apenas administradores podem acessar essas configurações</p></div>;
  return <FinancialPasswordProtection module="seguranca"><div className="w-full min-w-0 space-y-6"><div><h1 className="text-3xl font-bold text-foreground">Configurações de Segurança</h1><p className="mt-2 text-muted-foreground">Acompanhe alertas e o histórico de auditoria do sistema.</p></div><Tabs defaultValue="alerts" className="w-full space-y-4"><TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-secondary/50"><TabsTrigger value="alerts" className="gap-2"><AlertTriangle className="h-4 w-4" />Alertas</TabsTrigger><TabsTrigger value="audit" className="gap-2"><History className="h-4 w-4" />Auditoria</TabsTrigger></TabsList><TabsContent value="alerts" className="w-full"><SecurityNotifications /></TabsContent><TabsContent value="audit" className="w-full"><AuditLog /></TabsContent></Tabs></div></FinancialPasswordProtection>;
}
