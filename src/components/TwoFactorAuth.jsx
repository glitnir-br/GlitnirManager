import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { base44 } from '@/api/dbClient';
import { useAuth } from '@/lib/AuthContext';
import { Shield, Copy, Check } from 'lucide-react';

export default function TwoFactorAuth() {
  const { user } = useAuth();
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    checkTwoFAStatus();
  }, [user]);

  const checkTwoFAStatus = async () => {
    try {
      const userProfiles = await base44.entities.UserProfile.filter({ email: user.email });
      if (userProfiles.length > 0) {
        setIs2FAEnabled(userProfiles[0].two_fa_enabled || false);
      }
    } catch (err) {
      console.error('Erro ao verificar 2FA:', err);
    }
  };

  const generateBackupCodes = () => {
    return Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );
  };

  const enable2FA = async () => {
    setLoading(true);
    try {
      const codes = generateBackupCodes();
      setBackupCodes(codes);
      setShowBackupCodes(true);

      // Salva os códigos de backup (em produção, criptografar!)
      const userProfiles = await base44.entities.UserProfile.filter({ email: user.email });
      if (userProfiles.length > 0) {
        await base44.entities.UserProfile.update(userProfiles[0].id, {
          two_fa_enabled: true,
          backup_codes: JSON.stringify(codes)
        });
      }

      setIs2FAEnabled(true);
    } catch (err) {
      console.error('Erro ao habilitar 2FA:', err);
    }
    setLoading(false);
  };

  const disable2FA = async () => {
    setLoading(true);
    try {
      const userProfiles = await base44.entities.UserProfile.filter({ email: user.email });
      if (userProfiles.length > 0) {
        await base44.entities.UserProfile.update(userProfiles[0].id, {
          two_fa_enabled: false,
          backup_codes: null
        });
      }
      setIs2FAEnabled(false);
    } catch (err) {
      console.error('Erro ao desabilitar 2FA:', err);
    }
    setLoading(false);
  };

  const copyBackupCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary mt-1" />
          <div>
            <h3 className="font-semibold text-foreground">Autenticação de Dois Fatores</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {is2FAEnabled ? 'Habilitado' : 'Desabilitado'} - Adicione uma camada extra de segurança à sua conta
            </p>
          </div>
        </div>
        <Button
          onClick={is2FAEnabled ? disable2FA : enable2FA}
          disabled={loading}
          variant={is2FAEnabled ? 'destructive' : 'default'}
        >
          {loading ? 'Processando...' : is2FAEnabled ? 'Desabilitar' : 'Habilitar'}
        </Button>
      </div>

      {showBackupCodes && backupCodes.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border">
          <p className="text-sm font-semibold text-yellow-400 mb-4">
            ⚠️ Guarde esses códigos em segurança. Eles servem para recuperar a conta se perder o acesso:
          </p>
          <div className="grid grid-cols-2 gap-2 bg-secondary/30 p-4 rounded-lg">
            {backupCodes.map((code, idx) => (
              <div
                key={idx}
                onClick={() => copyBackupCode(code)}
                className="p-2 bg-secondary rounded cursor-pointer hover:bg-secondary/80 transition-colors flex items-center justify-between"
              >
                <code className="text-xs font-mono text-foreground">{code}</code>
                {copiedCode === code ? (
                  <Check className="w-3 h-3 text-green-400" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
