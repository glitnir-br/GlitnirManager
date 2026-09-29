import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useFinancialPassword } from '@/lib/FinancialPasswordContext';

const MODULE_NAMES = {
  doacoes: 'Doações/GC',
  compras: 'Pacotes Guildas',
  despesas: 'Despesas'
};

export default function FinancialPasswordField({ title, module }) {
  const { user } = useAuth();
  const { lockAllModules } = useFinancialPassword();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 6) {
      setError('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      // Busca se já existe registro
      const existing = await base44.entities.AdminSettings.filter({
        setting_key: `password_${module}`
      });

      if (existing.length > 0) {
        // Atualiza registro existente
        await base44.entities.AdminSettings.update(existing[0].id, {
          admin_password: newPassword,
          updated_by: user.email,
        });
      } else {
        // Cria novo registro
        await base44.entities.AdminSettings.create({
          setting_key: `password_${module}`,
          admin_password: newPassword,
          updated_by: user.email,
        });
      }
      setMessage(`Senha de ${title} atualizada com sucesso!`);
      setNewPassword('');
      setConfirmPassword('');
      // Força reautenticação em todos os módulos
      lockAllModules();
    } catch (err) {
      setError('Erro ao atualizar senha');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handlePasswordUpdate} className="space-y-4">
      <h3 className="font-semibold text-foreground">{title}</h3>
      
      <div>
        <Label className="text-foreground text-sm">Nova Senha</Label>
        <div className="relative mt-2">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Digite a nova senha"
            className="bg-secondary pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <Label className="text-foreground text-sm">Confirmar Senha</Label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirme a nova senha"
          className="bg-secondary mt-2"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {message && <p className="text-green-400 text-sm">{message}</p>}

      <Button type="submit" disabled={loading} size="sm" className="bg-primary hover:bg-primary/90">
        {loading ? 'Atualizando...' : 'Atualizar'}
      </Button>
    </form>
  );
}