import React from 'react';
import { Clock } from 'lucide-react';

export default function PendingApprovalScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="w-full max-w-md px-4">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-accent" />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-foreground">Pendente de Aprovação</h1>
            <p className="text-muted-foreground">
              Sua conta foi registrada, mas aguarda aprovação do administrador para acessar o sistema.
            </p>
          </div>

          <div className="bg-secondary/50 border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground text-center">
              Você será notificado assim que sua solicitação for analisada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}