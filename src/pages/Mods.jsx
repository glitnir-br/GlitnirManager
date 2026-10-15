import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderCog, Image } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import Arquivos from '@/pages/Arquivos';
import Atelier from '@/pages/Atelier';

export default function Mods() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManageFiles = ['adm_principal', 'administrador'].includes(user?.role);
  const requestedTab = searchParams.get('tab');
  const activeTab = canManageFiles && requestedTab !== 'atelier' ? 'files' : 'atelier';

  const changeTab = (tab) => {
    setSearchParams(tab === 'atelier' ? { tab: 'atelier' } : {}, { replace: true });
  };

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">Mods</h1>
      <p className="mt-1 text-sm text-muted-foreground">Arquivos dos servidores e imagens do Atelier em um só lugar.</p>
    </div>
    <Tabs value={activeTab} onValueChange={changeTab}>
      <TabsList className={`grid w-full ${canManageFiles ? 'grid-cols-2' : 'grid-cols-1'} sm:w-auto`}>
        {canManageFiles && <TabsTrigger value="files" className="gap-2"><FolderCog className="h-4 w-4" />Arquivos e Mods</TabsTrigger>}
        <TabsTrigger value="atelier" className="gap-2"><Image className="h-4 w-4" />Atelier</TabsTrigger>
      </TabsList>
    </Tabs>
    {activeTab === 'atelier' ? <Atelier embedded /> : <Arquivos embedded />}
  </div>;
}
