import { ShieldOff } from 'lucide-react';

export default function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <ShieldOff className="w-12 h-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold text-foreground">Acesso Negado</h2>
      <p className="text-muted-foreground text-sm max-w-sm">
        Você não possui permissão para acessar esta área. Entre em contato com o administrador.
      </p>
    </div>
  );
}
