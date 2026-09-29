import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/dbClient';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function AccessRequestNotification() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'adm_principal') return;

    const loadPending = async () => {
      const requests = await base44.entities.AccessRequest.filter({ status: 'pendente' });
      setPendingCount(requests.length);
    };

    loadPending();

    // Subscribe to real-time changes
    const unsubscribe = base44.entities.AccessRequest.subscribe((event) => {
      loadPending();
    });

    return unsubscribe;
  }, [user]);

  if (user?.role !== 'adm_principal' || pendingCount === 0) return null;

  return (
    <Link
      to="/admin-settings"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:bg-primary/90 transition-all animate-pulse"
    >
      <Bell className="w-4 h-4" />
      <span className="text-sm font-semibold">{pendingCount} solicitação{pendingCount > 1 ? 'ões' : ''} pendente{pendingCount > 1 ? 's' : ''}</span>
    </Link>
  );
}
