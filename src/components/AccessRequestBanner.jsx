import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function AccessRequestBanner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="w-full max-w-md text-center">
        <div className="p-6 bg-yellow-500/20 border border-yellow-500/30 rounded-xl mb-6">
          <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-3">Acesso Aguardando Aprovação</h1>
        <p className="text-muted-foreground text-lg mb-6">
          Sua solicitação de acesso está sendo analisada pela administração. Você será notificado assim que sua conta for aprovada.
        </p>

        <div className="bg-card border border-border rounded-lg p-4 text-muted-foreground text-sm">
          <p className="mb-2">⏳ Tempo médio de aprovação: 24 horas</p>
          <p>Se tiver dúvidas, entre em contato com a administração.</p>
        </div>
      </div>
    </div>
  );
}
