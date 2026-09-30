import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, DollarSign, ShoppingCart, ShieldBan, X, TrendingDown, BarChart2, Shield, Lock, UserCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';

const allNavItems = [
  { label: 'Dashboard',       path: '/',                 icon: LayoutDashboard, roles: ['adm_principal', 'administrador', 'financeiro', 'moderador', 'suporte', 'visitante'] },
  { label: 'Players',         path: '/players',          icon: Users,           roles: ['adm_principal', 'administrador', 'financeiro', 'moderador', 'suporte', 'visitante'] },
  { label: 'Banidos',         path: '/banidos',          icon: ShieldBan,       roles: ['adm_principal', 'administrador', 'moderador', 'suporte', 'visitante'] },
  { label: 'Doações / GC',   path: '/financas',         icon: DollarSign,      roles: ['adm_principal', 'administrador', 'financeiro'] },
  { label: 'Pacotes Guildas', path: '/compras',          icon: ShoppingCart,    roles: ['adm_principal', 'administrador', 'financeiro', 'suporte'] },
  { label: 'Despesas',        path: '/despesas',         icon: TrendingDown,    roles: ['adm_principal', 'administrador', 'financeiro'] },
  { label: 'Relatórios',      path: '/relatorios',       icon: BarChart2,       roles: ['adm_principal', 'administrador', 'financeiro'] },
  { label: 'Gerenciar Acesso', path: '/admin-access',     icon: UserCircle,      roles: ['adm_principal', 'administrador'] },
  { label: 'Configurações',   path: '/admin-settings',   icon: Shield,          roles: ['adm_principal'] },
  { label: 'Segurança',       path: '/security-settings',icon: Lock,            roles: ['adm_principal'] },
];

export default function Sidebar({ open, setOpen }) {
  const location = useLocation();
  const { user } = useAuth();
  const navItems = allNavItems.filter(item => item.roles.includes(user?.role));

  return (
    <>
      {open &&
      <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setOpen(false)} />
      }

      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border flex flex-col transition-transform duration-300",
        "lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src="https://media.base44.com/images/public/6a0b4a195c99d0786cd4f7a2/256b8b6b7_image.png"
                alt="Glitnir"
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="font-bold text-foreground tracking-tight">Glitnir Manager</h1>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isBanidos = item.path === '/banidos';
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive && isBanidos ?
                  "bg-red-500/15 text-red-400 shadow-[0_0_20px_-5px_rgba(239,68,68,0.3)]" :
                  isActive ?
                  "bg-primary/15 text-primary shadow-[0_0_20px_-5px_hsl(270,70%,55%,0.3)]" :
                  "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}>
                
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>);

          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <a
            href="http://162.43.190.115/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <ExternalLink className="w-5 h-5" />
            Painel Glitnir
          </a>
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              location.pathname === '/profile'
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <UserCircle className="w-5 h-5" />
            Meu Perfil
          </Link>
          <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest">Glitnir CONTROLE v1.0</p>
        </div>
      </aside>
    </>);

}
