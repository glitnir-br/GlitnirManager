import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/dbClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Shield } from 'lucide-react';

export default function SecurityNotifications() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!user) return;

    // Buscar eventos de segurança dos últimos 7 dias
    const checkSecurityEvents = async () => {
      try {
        const logs = await base44.entities.SecurityLog.filter(
          { user_email: user.email },
          '-created_date',
          20
        );

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentLogs = logs.filter(log => new Date(log.created_date) > sevenDaysAgo);

        const newAlerts = [];

        // Alertar sobre tentativas não autorizadas
        const unauthorizedAttempts = recentLogs.filter(l => l.action === 'unauthorized_attempt');
        if (unauthorizedAttempts.length > 0) {
          newAlerts.push({
            id: 'unauthorized',
            type: 'danger',
            title: 'Tentativas Não Autorizadas',
            message: `${unauthorizedAttempts.length} tentativas não autorizadas nos últimos 7 dias`,
            icon: AlertTriangle
          });
        }

        // Alertar sobre mudanças de role
        const roleChanges = recentLogs.filter(l => l.action === 'role_changed');
        if (roleChanges.length > 0) {
          newAlerts.push({
            id: 'role-change',
            type: 'warning',
            title: 'Mudanças de Permissões',
            message: `Suas permissões foram alteradas recentemente`,
            icon: Shield
          });
        }

        setAlerts(newAlerts);
      } catch (err) {
        console.error('Erro ao verificar segurança:', err);
      }
    };

    checkSecurityEvents();
    const interval = setInterval(checkSecurityEvents, 5 * 60 * 1000); // A cada 5 min

    return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="w-full space-y-3">
      {alerts.map(alert => {
        const Icon = alert.icon;
        return (
          <Alert
            key={alert.id}
            className={`w-full ${alert.type === 'danger' ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}
          >
            <Icon className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold text-foreground">{alert.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
