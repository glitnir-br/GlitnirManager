import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DollarSign, TrendingDown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Financas from '@/pages/Financas';
import Despesas from '@/pages/Despesas';

export default function Financeiro() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'despesas' ? 'despesas' : 'doacoes';

  const changeTab = (tab) => {
    setSearchParams(tab === 'doacoes' ? {} : { tab }, { replace: true });
  };

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">Financeiro</h1>
      <p className="mt-1 text-sm text-muted-foreground">Doações, moeda Glitnir e despesas em uma visão centralizada.</p>
    </div>
    <Tabs value={activeTab} onValueChange={changeTab}>
      <TabsList className="grid w-full grid-cols-2 sm:w-auto">
        <TabsTrigger value="doacoes" className="gap-2"><DollarSign className="h-4 w-4" />Doações</TabsTrigger>
        <TabsTrigger value="despesas" className="gap-2"><TrendingDown className="h-4 w-4" />Despesas</TabsTrigger>
      </TabsList>
    </Tabs>
    {activeTab === 'despesas' ? <Despesas embedded /> : <Financas embedded />}
  </div>;
}
