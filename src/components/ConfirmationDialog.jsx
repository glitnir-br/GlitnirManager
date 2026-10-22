import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export default function ConfirmationDialog({ confirmation, onClose }) {
  const confirm = () => {
    const action = confirmation?.onConfirm;
    onClose();
    action?.();
  };

  return <AlertDialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <AlertDialogContent className={cn('max-w-md', confirmation?.destructive && 'border-destructive/30')}>
      <AlertDialogHeader>
        <div className={cn('mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary', confirmation?.destructive && 'bg-destructive/10 text-destructive')}><AlertTriangle className="h-5 w-5" /></div>
        <AlertDialogTitle>{confirmation?.title || 'Confirmar ação?'}</AlertDialogTitle>
        <AlertDialogDescription>{confirmation?.description || 'Revise os dados antes de continuar.'}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className={confirmation?.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''} onClick={confirm}>{confirmation?.confirmLabel || 'Confirmar'}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
