import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Sidebar from './Sidebar';
import AccessRequestNotification from './AccessRequestNotification';
import { useServer, SERVERS } from '@/lib/ServerContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { server, setServer } = useServer();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
        <span className="font-bold text-foreground">Glitnir Nexus</span>
        <Select value={server} onValueChange={setServer}>
          <SelectTrigger className="ml-auto h-9 w-32 bg-secondary text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{SERVERS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <AccessRequestNotification />

      {/* Main content */}
      <main className="min-h-screen min-w-0 pt-16 lg:ml-64 lg:pt-0">
        <div className="hidden lg:flex justify-end pb-3">
          <Select value={server} onValueChange={setServer}>
            <SelectTrigger className="h-9 w-36 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>{SERVERS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-full min-w-0 p-4 md:p-8 lg:pt-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
