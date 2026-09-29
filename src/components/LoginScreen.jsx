import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import { Lock, User, Eye, EyeOff, ShieldCheck, LogIn, Chrome } from 'lucide-react';

export default function LoginScreen() {
  const { loginWithPassword, navigateToLogin, isLoadingAuth } = useAuth();
  
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await loginWithPassword(username, password);
      if (!res.success) {
        setError(res.message || 'Credenciais inválidas.');
      }
    } catch (err) {
      setError('Ocorreu um erro ao tentar realizar o login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
                <img
                  src="https://media.base44.com/images/public/6a0b4a195c99d0786cd4f7a2/256b8b6b7_image.png"
                  alt="Glitnir"
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <ShieldCheck className="w-8 h-8 text-primary font-bold" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Glitnir Manager</h1>
            <p className="text-sm text-muted-foreground">Painel de Controle Administrativo</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/15 border border-destructive/30 text-destructive text-xs p-3 rounded-lg text-center font-medium">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-semibold text-foreground/80">
                Usuário ou E-mail
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Digite seu usuário ou e-mail"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground/80">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 h-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || isLoadingAuth}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <LogIn className="w-4 h-4" />
              {isSubmitting ? 'Entrando...' : 'Entrar no Sistema'}
            </Button>
          </form>

          {/* Cards de Usuário Padrão */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-2 text-center">
              💡 Credenciais Padrão (Ambiente Local)
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin', 'admin123')}
                className="text-left p-2.5 rounded-lg border border-border/70 hover:border-primary/50 bg-secondary/30 hover:bg-secondary/60 transition-all text-xs flex justify-between items-center group"
              >
                <div>
                  <span className="font-semibold text-foreground">Administrador</span>
                  <div className="text-[11px] text-muted-foreground">Usuário: <code className="text-primary font-mono">admin</code> | Senha: <code className="text-primary font-mono">admin123</code></div>
                </div>
                <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 font-semibold transition-opacity">Usar →</span>
              </button>
            </div>
          </div>

          <div className="text-center text-[11px] text-muted-foreground">
            Acesso local seguro • Glitnir Manager
          </div>
        </div>
      </div>
    </div>
  );
}