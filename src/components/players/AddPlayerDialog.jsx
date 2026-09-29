import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const initialForm = {
  nick: '', steamid: '', status: 'ativo', guilda: '', observacao: '', cor: '',
};

export default function AddPlayerDialog({ open, onOpenChange, onAdd }) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [bannedInfo, setBannedInfo] = useState(null);

  useEffect(() => {
    const steamid = form.steamid.trim();
    if (!steamid || steamid.length < 5) { setBannedInfo(null); return; }
    const timer = setTimeout(async () => {
      const results = await base44.entities.Banido.filter({ steamid });
      setBannedInfo(results.length > 0 ? results[0] : null);
    }, 400);
    return () => clearTimeout(timer);
  }, [form.steamid]);

  const handleSubmit = async () => {
    if (!form.nick || !form.steamid) return;
    setLoading(true);
    await onAdd(form);
    setForm(initialForm);
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Adicionar Player</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nick *</Label>
            <Input value={form.nick} onChange={(e) => setForm({ ...form, nick: e.target.value })} className="bg-secondary" placeholder="Ex: xGamer123" />
          </div>
          <div className="space-y-2">
            <Label>Steam ID *</Label>
            <Input
              value={form.steamid}
              onChange={(e) => setForm({ ...form, steamid: e.target.value })}
              className={`font-mono ${bannedInfo ? 'bg-red-950 border-red-500 text-red-300 focus-visible:ring-red-500' : 'bg-secondary'}`}
              placeholder="Ex: 76561198..."
            />
            {bannedInfo && (
              <div className="flex items-start gap-2 bg-red-950/60 border border-red-500 rounded-md px-3 py-2 text-red-300 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
                <div>
                  <span className="font-bold text-red-400">⚠ STEAM ID BANIDA</span>
                  <div>Nick: <span className="font-semibold">{bannedInfo.data?.nick || bannedInfo.nick || '—'}</span></div>
                  {(bannedInfo.data?.motivo || bannedInfo.motivo) && (
                    <div>Motivo: <span className="font-semibold">{bannedInfo.data?.motivo || bannedInfo.motivo}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="banido">Banido</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Guilda</Label>
              <Input value={form.guilda} onChange={(e) => setForm({ ...form, guilda: e.target.value })} className="bg-secondary" placeholder="Ex: Vikings" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cor (hex)</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={form.cor || '#a855f7'}
                onChange={(e) => setForm({ ...form, cor: e.target.value })}
                className="w-12 h-10 p-1 bg-secondary cursor-pointer"
              />
              <Input
                value={form.cor}
                onChange={(e) => setForm({ ...form, cor: e.target.value })}
                className="bg-secondary font-mono"
                placeholder="#a855f7"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="bg-secondary" placeholder="Anotações sobre o player..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setForm(initialForm); setBannedInfo(null); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.nick || !form.steamid} className="bg-primary hover:bg-primary/90">
            {loading ? 'Salvando...' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}