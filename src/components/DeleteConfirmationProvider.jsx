import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { setDeleteConfirmationHandler } from '@/lib/delete-confirmation';

export default function DeleteConfirmationProvider({ children }) {
  const [resolve, setResolve] = useState(null);

  useEffect(() => {
    setDeleteConfirmationHandler(() => new Promise((done) => setResolve(() => done)));
    return () => setDeleteConfirmationHandler(null);
  }, []);

  const close = (confirmed) => {
    resolve?.(confirmed);
    setResolve(null);
  };

  return <>
    {children}
    <AlertDialog open={Boolean(resolve)} onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent className="max-w-md border-destructive/30 bg-card">
        <AlertDialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/15">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação é permanente e não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => close(true)}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
