import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/api/dbClient';

const SERVER_LABELS = { server_1: 'Server 1', server_2: 'Server 2' };

async function callAtelier(body) {
  if (!supabase) throw new Error('A conexão com o Supabase é necessária.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre novamente no sistema.');
  const response = await fetch('/api/atelier-artwork', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Falha ao comunicar com o Atelier.');
  return result;
}

export default function Atelier() {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteFile, setDeleteFile] = useState(null);
  const [uploadServer, setUploadServer] = useState('todos');
  const [deleteServer, setDeleteServer] = useState('todos');
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['atelier-artwork'], queryFn: () => callAtelier({ action: 'list' }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['atelier-artwork'] });
  const uploadMutation = useMutation({ mutationFn: async () => {
    if (!file?.type.startsWith('image/')) throw new Error('Selecione apenas um arquivo de imagem.');
    if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');
    const contentBase64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    return callAtelier({ action: 'upload', server: uploadServer, name: file.name, mime: file.type, contentBase64 });
  }, onSuccess: () => { setUploadOpen(false); setFile(null); setMessage('Imagem enviada com sucesso.'); refresh(); }, onError: (e) => setMessage(e.message) });
  const deleteMutation = useMutation({ mutationFn: () => callAtelier({ action: 'delete', server: deleteServer, name: deleteFile.name }), onSuccess: () => { setDeleteFile(null); setMessage('Imagem removida com sucesso.'); refresh(); }, onError: (e) => setMessage(e.message) });
  const files = data?.files || [];

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15"><Image className="h-5 w-5 text-primary" /></div><div><h1 className="text-2xl font-bold text-foreground md:text-3xl">Atelier</h1><p className="mt-0.5 text-sm text-muted-foreground">{files.length} imagens encontradas nos servidores</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={refresh} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Sincronizar</Button><Button onClick={() => setUploadOpen(true)}><Plus className="mr-2 h-4 w-4" />Adicionar imagem</Button></div></div>
    {message && <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">{message}</div>}
    {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error.message}</div>}
    <div className="overflow-hidden rounded-xl border border-border"><Table><TableHeader><TableRow><TableHead>Imagem</TableHead><TableHead>Disponível em</TableHead><TableHead>Tamanho</TableHead><TableHead className="w-14" /></TableRow></TableHeader><TableBody>{isLoading ? <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">Carregando imagens...</TableCell></TableRow> : files.length === 0 ? <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">Nenhuma imagem encontrada</TableCell></TableRow> : files.map((item) => <TableRow key={item.name}><TableCell className="font-medium">{item.name}</TableCell><TableCell><div className="flex gap-1.5">{item.servers.map((server) => <span key={server} className={`rounded-full border px-2 py-1 text-xs font-semibold ${server === 'server_1' ? 'border-blue-500/40 bg-blue-500/15 text-blue-300' : 'border-violet-500/40 bg-violet-500/15 text-violet-300'}`}>{SERVER_LABELS[server]}</span>)}</div></TableCell><TableCell className="text-sm text-muted-foreground">{item.size ? `${(item.size / 1024).toFixed(item.size > 1024 * 1024 ? 0 : 1)} ${item.size > 1024 * 1024 ? 'MB' : 'KB'}` : '-'}</TableCell><TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDeleteFile(item); setDeleteServer('todos'); }}><Trash2 className="h-4 w-4 text-red-400" /></Button></TableCell></TableRow>)}</TableBody></Table></div>
    <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) setFile(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" />Adicionar imagem</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>Imagem</Label><input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium" />{file && <p className="text-xs text-muted-foreground">{file.name}</p>}</div><div className="space-y-2"><Label>Enviar para</Label><Select value={uploadServer} onValueChange={setUploadServer}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="server_1">Server 1</SelectItem><SelectItem value="server_2">Server 2</SelectItem><SelectItem value="todos">Todos os servidores</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button><Button onClick={() => uploadMutation.mutate()} disabled={!file || uploadMutation.isPending}>{uploadMutation.isPending ? 'Enviando...' : 'Enviar imagem'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(deleteFile)} onOpenChange={(open) => !open && setDeleteFile(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Remover imagem</DialogTitle></DialogHeader><div className="space-y-4 py-2"><p className="text-sm text-muted-foreground">Deseja remover <span className="font-medium text-foreground">{deleteFile?.name}</span>?</p><div className="space-y-2"><Label>Remover de</Label><Select value={deleteServer} onValueChange={setDeleteServer}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os servidores</SelectItem><SelectItem value="server_1">Server 1</SelectItem><SelectItem value="server_2">Server 2</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setDeleteFile(null)}>Cancelar</Button><Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Removendo...' : 'Remover'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
