import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Crown, ShieldBan, Users } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { SERVERS, useServer } from '@/lib/ServerContext';
import Players from '@/pages/Players';
import Banidos from '@/pages/Banidos';
import Vip from '@/pages/Vip';
import { usePermissions } from '@/lib/PermissionsContext';

export default function Jogadores() {
  const { user } = useAuth();
  const { hasPage } = usePermissions();
  const { server, setServer } = useServer();
  const [searchParams, setSearchParams] = useSearchParams();
  const canViewBanned = ['adm_principal', 'administrador', 'visitante'].includes(user?.role);
  const canViewVip = hasPage('vip_history') || hasPage('vip_deliveries') || hasPage('vip_manage_packages');
  const requestedTab = searchParams.get('tab');
  const activeTab = canViewVip && requestedTab === 'vip' ? 'vip' : canViewBanned && requestedTab === 'banidos' ? 'banidos' : 'players';

  const changeTab = (tab) => {
    setSearchParams(tab === 'players' ? {} : { tab }, { replace: true });
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-bold text-foreground md:text-3xl">Jogadores</h1><p className="mt-1 text-sm text-muted-foreground">Cadastros, whitelist e banimentos dos servidores.</p></div>
      <div className="w-full sm:w-52"><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Servidor</label><Select value={server} onValueChange={setServer}><SelectTrigger className="bg-secondary font-semibold"><SelectValue /></SelectTrigger><SelectContent>{SERVERS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <Tabs value={activeTab} onValueChange={changeTab}>
      <TabsList className={`grid w-full ${canViewBanned && canViewVip ? 'grid-cols-3' : canViewBanned || canViewVip ? 'grid-cols-2' : 'grid-cols-1'} sm:w-auto`}>
        <TabsTrigger value="players" className="gap-2"><Users className="h-4 w-4" />Players</TabsTrigger>
        {canViewBanned && <TabsTrigger value="banidos" className="gap-2 data-[state=active]:text-red-400"><ShieldBan className="h-4 w-4" />Banidos</TabsTrigger>}
        {canViewVip && <TabsTrigger value="vip" className="gap-2"><Crown className="h-4 w-4" />VIP</TabsTrigger>}
      </TabsList>
    </Tabs>
    {activeTab === 'vip' ? <Vip /> : activeTab === 'banidos' ? <Banidos embedded /> : <Players embedded />}
  </div>;
}
