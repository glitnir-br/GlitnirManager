import { useState } from 'react';
import { Eye, EyeOff, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { base44, supabase } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';

export default function ForcedPasswordChange() {
  const { user, checkAppState, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('A nova senha deve ter ao menos 8 caracteres.');
    if (password !== confirmation) return setError('A confirmação da senha não confere.');
    if (!supabase) return setError('A alteração de senha exige conexão com o Supabase.');

    setIsSubmitting(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;
      const profiles = await base44.entities.UserProfile.filter({ email: user.email });
      if (!profiles[0]) throw new Error('Perfil do usuário não encontrado.');
      await base44.entities.UserProfile.update(profiles[0].id, { must_change_password: false });
      await checkAppState();
      navigate('/', { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Não foi possível alterar a senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"><ShieldCheck className="h-8 w-8 text-primary" /></div>
          <h1 className="text-2xl font-bold text-foreground">Crie uma nova senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">Este é seu primeiro acesso. Defina uma senha pessoal para continuar.</p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-center text-xs font-medium text-destructive">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="new-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" className="h-11 pl-9 pr-10" minLength={8} autoComplete="new-password" autoFocus required />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input id="confirm-password" type={showPassword ? 'text' : 'password'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-11" minLength={8} autoComplete="new-password" required />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar nova senha e continuar'}</Button>
        </form>
        <button type="button" onClick={() => logout()} className="mx-auto mt-5 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" /> Sair da conta</button>
      </div>
    </div>
  );
}
