import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { ShieldOff, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const FINANCE_PASSWORD = 'glitnir2025';

export default function FinanceGuard({ children }) {
  // As senhas adicionais para áreas financeiras foram removidas a pedido do usuário
  return children;
}
