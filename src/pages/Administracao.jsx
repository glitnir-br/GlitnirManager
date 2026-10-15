import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, Settings, ShieldCheck, UserCircle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import AdminAccess from '@/pages/AdminAccess';
import AdminSettings from '@/pages/AdminSettings';
import SecuritySettings from '@/pages/SecuritySettings';
import CargosPermissoes from '@/pages/CargosPermissoes';

export default function Administracao() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPrincipal = user?.role === 'adm_principal';
  const requestedTab = searchParams.get('tab');
  const activeTab = isPrincipal && ['configuracoes', 'seguranca', 'permissoes'].includes(requestedTab) ? requestedTab : 'acessos';

  const changeTab = (tab) => {
    setSearchParams(tab === 'acessos' ? {} : { tab }, { replace: true });
  };

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">Administração</h1>
      <p className="mt-1 text-sm text-muted-foreground">Acessos, configurações do sistema e segurança.</p>
    </div>
    <Tabs value={activeTab} onValueChange={changeTab}>
      <TabsList className={`grid h-auto w-full ${isPrincipal ? 'grid-cols-4' : 'grid-cols-1'} sm:w-auto`}>
        <TabsTrigger value="acessos" className="gap-2"><UserCircle className="h-4 w-4" />Acessos</TabsTrigger>
        {isPrincipal && <TabsTrigger value="configuracoes" className="gap-2"><Settings className="h-4 w-4" />Configurações</TabsTrigger>}
        {isPrincipal && <TabsTrigger value="seguranca" className="gap-2"><Lock className="h-4 w-4" />Segurança</TabsTrigger>}
        {isPrincipal && <TabsTrigger value="permissoes" className="gap-2"><ShieldCheck className="h-4 w-4" />Cargos e permissões</TabsTrigger>}
      </TabsList>
    </Tabs>
    {activeTab === 'acessos' && <AdminAccess />}
    {activeTab === 'configuracoes' && <AdminSettings />}
    {activeTab === 'seguranca' && <SecuritySettings />}
    {activeTab === 'permissoes' && <CargosPermissoes />}
  </div>;
}
