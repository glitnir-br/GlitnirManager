import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldBan, Users } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import Players from '@/pages/Players';
import Banidos from '@/pages/Banidos';

export default function Jogadores() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canViewBanned = ['adm_principal', 'administrador', 'visitante'].includes(user?.role);
  const requestedTab = searchParams.get('tab');
  const activeTab = canViewBanned && requestedTab === 'banidos' ? 'banidos' : 'players';

  const changeTab = (tab) => {
    setSearchParams(tab === 'banidos' ? { tab: 'banidos' } : {}, { replace: true });
  };

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">Jogadores</h1>
      <p className="mt-1 text-sm text-muted-foreground">Cadastros, whitelist e banimentos dos servidores.</p>
    </div>
    <Tabs value={activeTab} onValueChange={changeTab}>
      <TabsList className={`grid w-full ${canViewBanned ? 'grid-cols-2' : 'grid-cols-1'} sm:w-auto`}>
        <TabsTrigger value="players" className="gap-2"><Users className="h-4 w-4" />Players</TabsTrigger>
        {canViewBanned && <TabsTrigger value="banidos" className="gap-2 data-[state=active]:text-red-400"><ShieldBan className="h-4 w-4" />Banidos</TabsTrigger>}
      </TabsList>
    </Tabs>
    {activeTab === 'banidos' ? <Banidos embedded /> : <Players embedded />}
  </div>;
}
