import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useAdminAuth } from '@/lib/AdminAuthContext';

export default function PasswordProtectedArea({ children, title = 'Área Protegida' }) {
  // Solicitação de senha adicional removida a pedido do usuário
  return children;
}