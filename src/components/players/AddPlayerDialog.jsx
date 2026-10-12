import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { base44 } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const initialForm = { steamid: '', observacao: '' };
const normalizeSteamId = (value) => value.trim().replace(/^Steam_/i, '');
const isValidSteamId = (value) => /^\d{17}$/.test(normalizeSteamId(value));

export default function AddPlayerDialog({ open, onOpenChange, onAdd, server, players = [] }) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [bannedInfo, setBannedInfo] = useState(null);
  const steamid = normalizeSteamId(form.steamid);
  const isDuplicate = useMemo(
    () => players.some((player) => normalizeSteamId(player.steamid || '') === steamid),
    [players, steamid],
  );
  const validationMessage = !form.steamid
    ? ''
    : !isValidSteamId(form.steamid)
      ? 'Informe um Steam ID válido com 17 dígitos.'
      : isDuplicate
        ? 'Este Steam ID já está cadastrado neste servidor.'
        : '';

  useEffect(() => {
    if (!isValidSteamId(form.steamid)) {
      setBannedInfo(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      const results = await base44.entities.Banido.filter({ steamid, server });
      setBannedInfo(results.find((item) => item.na_banlist !== false) || null);
    }, 350);
    return () => clearTimeout(timer);
  }, [form.steamid, server, steamid]);

  const close = () => {
    setForm(initialForm);
    setBannedInfo(null);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (validationMessage || bannedInfo || !isValidSteamId(form.steamid)) return;
    setLoading(true);
    try {
      const bannedRecords = await base44.entities.Banido.filter({ steamid, server });
      const activeBan = bannedRecords.find((item) => item.na_banlist !== false);
      if (activeBan) {
        setBannedInfo(activeBan);
        return;
      }
      await onAdd({
        steamid,
        observacao: form.observacao.trim(),
        nick: '',
        personagens: [],
        status: 'inativo',
        guilda: '',
        cor: '',
        na_whitelist: false,
      });
      close();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader><DialogTitle>Adicionar player</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Steam ID *</Label>
            <Input
              value={form.steamid}
              onChange={(event) => setForm({ ...form, steamid: event.target.value })}
              className={`font-mono ${validationMessage || bannedInfo ? 'border-red-500 bg-red-950 text-red-300 focus-visible:ring-red-500' : 'bg-secondary'}`}
              placeholder="Ex: 76561198000000000"
              inputMode="numeric"
            />
            {validationMessage && <p className="text-sm text-red-400">{validationMessage}</p>}
            {bannedInfo && (
              <div className="flex items-start gap-2 rounded-md border border-red-500 bg-red-950/60 px-3 py-2 text-sm text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div><strong>Steam ID banido.</strong> Não é possível cadastrá-lo enquanto constar na banlist.</div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.observacao} onChange={(event) => setForm({ ...form, observacao: event.target.value })} className="bg-secondary" placeholder="Anotações sobre o player..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || Boolean(validationMessage) || Boolean(bannedInfo) || !form.steamid} className="bg-primary hover:bg-primary/90">
            {loading ? 'Validando...' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
