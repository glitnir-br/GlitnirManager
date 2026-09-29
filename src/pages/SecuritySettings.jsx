import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import TwoFactorAuth from '@/components/TwoFactorAuth';
import AuditLog from '@/components/security/AuditLog';
import SecurityNotifications from '@/components/security/SecurityNotifications';
import FinancialPasswordProtection from '@/components/FinancialPasswordProtection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, AlertTriangle, History, Lock } from 'lucide-react';

export default function SecuritySettings() {
  const { user } = useAuth();

  if (!user) {
    return <div>Carregando...</div>;
  }

  // Apenas adm_principal pode acessar
  if (user.role !== 'adm_principal') {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Lock className="w-12 h-12 text-red-400" />
        <h2 className="text-2xl font-bold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground">Apenas administradores podem acessar essas configurações</p>
      </div>
    );
  }

  return (
    <FinancialPasswordProtection module="seguranca">
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações de Segurança</h1>
        <p className="text-muted-foreground mt-2">Gerencie a segurança da sua conta e veja o histórico de atividades</p>
      </div>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="alerts" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="2fa" className="gap-2">
            <Shield className="w-4 h-4" />
            2FA
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <History className="w-4 h-4" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <SecurityNotifications />
        </TabsContent>

        <TabsContent value="2fa">
          <TwoFactorAuth />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLog />
        </TabsContent>
      </Tabs>
    </div>
    </FinancialPasswordProtection>
  );
}