import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Sidebar from './Sidebar';
import AccessRequestNotification from './AccessRequestNotification';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
        <span className="font-bold text-foreground">Glitnir Nexus</span>
      </div>

      <AccessRequestNotification />

      {/* Main content */}
      <main className="min-h-screen min-w-0 pt-16 lg:ml-64 lg:pt-0">
        <div className="w-full min-w-0 p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
