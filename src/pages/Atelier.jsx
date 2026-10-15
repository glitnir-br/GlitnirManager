import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Grid2X2, Image, ImageOff, List, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
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
  const response = await fetch('/api/atelier-artwork', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Falha ao comunicar com o Atelier.');
  return result;
}

async function downloadAtelier(body) {
  if (!supabase) throw new Error('A conexão com o Supabase é necessária.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre novamente no sistema.');
  const response = await fetch('/api/atelier-artwork', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Não foi possível baixar a imagem.'); }
  return response.blob();
}

function saveDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ServerTags({ servers }) {
  return <div className="flex flex-wrap gap-1.5">{servers.map((server) => <span key={server} className={`rounded-full border px-2 py-1 text-xs font-semibold ${server === 'server_1' ? 'border-blue-500/40 bg-blue-500/15 text-blue-300' : 'border-violet-500/40 bg-violet-500/15 text-violet-300'}`}>{SERVER_LABELS[server]}</span>)}</div>;
}

function ArtworkPreview({ file, className = '' }) {
  return file.previewUrl ? <img src={file.previewUrl} alt={file.name} className={className} /> : <ImageOff className="h-8 w-8 text-muted-foreground" />;
}

export default function Atelier() {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteFile, setDeleteFile] = useState(null);
  const [uploadServer, setUploadServer] = useState('todos');
  const [deleteServer, setDeleteServer] = useState('todos');
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [view, setView] = useState('cards');
  const [previewFile, setPreviewFile] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['atelier-artwork'], queryFn: () => callAtelier({ action: 'list' }) });
  const syncMutation = useMutation({
    mutationFn: () => callAtelier({ action: 'sync' }),
    onSuccess: (result) => {
      queryClient.setQueryData(['atelier-artwork'], { files: result.files });
      setMessage(`${result.total} imagens sincronizadas${result.copied ? ` · ${result.copied} copiadas para o armazenamento` : ''}.`);
    },
    onError: (mutationError) => setMessage(mutationError.message),
  });
  const downloadMutation = useMutation({
    mutationFn: async ({ name }) => ({ blob: await downloadAtelier({ action: name ? 'download' : 'download-all', ...(name ? { name } : {}) }), name: name || 'atelier-artwork.zip' }),
    onSuccess: ({ blob, name }) => { saveDownload(blob, name); setMessage(name === 'atelier-artwork.zip' ? 'Download de todas as imagens iniciado.' : 'Download da imagem iniciado.'); },
    onError: (mutationError) => setMessage(mutationError.message),
  });
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file?.type.startsWith('image/')) throw new Error('Selecione apenas um arquivo de imagem.');
      if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');
      const contentBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return callAtelier({ action: 'upload', server: uploadServer, name: file.name, mime: file.type, contentBase64 });
    },
    onSuccess: (result) => { setUploadOpen(false); setFile(null); queryClient.setQueryData(['atelier-artwork'], { files: result.files }); setMessage('Imagem enviada com sucesso.'); },
    onError: (mutationError) => setMessage(mutationError.message),
  });
  const deleteMutation = useMutation({
    mutationFn: () => callAtelier({ action: 'delete', server: deleteServer, name: deleteFile.name }),
    onSuccess: (result) => { setDeleteFile(null); queryClient.setQueryData(['atelier-artwork'], { files: result.files }); setMessage('Imagem removida com sucesso.'); },
    onError: (mutationError) => setMessage(mutationError.message),
  });
  const files = data?.files || [];
  useEffect(() => { if (!message) return undefined; const timer = window.setTimeout(() => setMessage(''), 5000); return () => window.clearTimeout(timer); }, [message]);

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15"><Image className="h-5 w-5 text-primary" /></div><div><h1 className="text-2xl font-bold text-foreground md:text-3xl">Atelier</h1><p className="mt-0.5 text-sm text-muted-foreground">{files.length} imagens encontradas nos servidores</p></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => downloadMutation.mutate({})} disabled={!files.length || downloadMutation.isPending}><Download className="mr-2 h-4 w-4" />{downloadMutation.isPending ? 'Preparando...' : 'Baixar todas'}</Button><Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}><RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />{syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}</Button><Button onClick={() => setUploadOpen(true)}><Plus className="mr-2 h-4 w-4" />Adicionar imagem</Button></div>
    </div>
    {message && <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">{message}</div>}
    {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error.message}</div>}
    {!isLoading && files.length > 0 && <div className="flex justify-end"><div className="flex rounded-lg border border-border p-1"><Button size="sm" variant={view === 'cards' ? 'secondary' : 'ghost'} onClick={() => setView('cards')}><Grid2X2 className="mr-2 h-4 w-4" />Cards</Button><Button size="sm" variant={view === 'list' ? 'secondary' : 'ghost'} onClick={() => setView('list')}><List className="mr-2 h-4 w-4" />Lista</Button></div></div>}
    {isLoading ? <div className="py-12 text-center text-muted-foreground">Carregando imagens...</div> : files.length === 0 ? <div className="rounded-xl border border-border py-12 text-center text-muted-foreground">Nenhuma imagem encontrada</div> : view === 'cards' ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{files.map((item) => <article key={item.name} className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"><button type="button" className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-secondary/50 p-2" onClick={() => setPreviewFile(item)} aria-label={`Visualizar ${item.name}`}><ArtworkPreview file={item} className="h-full w-full object-contain" /></button><div className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate font-medium text-foreground" title={item.name}>{item.name}</p><div className="-mr-2 -mt-1 flex shrink-0"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadMutation.mutate({ name: item.name })} disabled={downloadMutation.isPending} aria-label={`Baixar ${item.name}`}><Download className="h-4 w-4 text-primary" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDeleteFile(item); setDeleteServer('todos'); }} aria-label={`Remover ${item.name}`}><Trash2 className="h-4 w-4 text-red-400" /></Button></div></div><div className="flex items-center justify-between gap-2"><ServerTags servers={item.servers} /><span className="shrink-0 text-xs text-muted-foreground">{item.size ? `${(item.size / 1024).toFixed(item.size > 1024 * 1024 ? 0 : 1)} ${item.size > 1024 * 1024 ? 'MB' : 'KB'}` : '-'}</span></div></div></article>)}</div> : <div className="overflow-hidden rounded-xl border border-border"><Table><TableHeader><TableRow><TableHead>Imagem</TableHead><TableHead>Disponível em</TableHead><TableHead>Tamanho</TableHead><TableHead className="w-32" /></TableRow></TableHeader><TableBody>{files.map((item) => <TableRow key={item.name}><TableCell className="font-medium">{item.name}</TableCell><TableCell><ServerTags servers={item.servers} /></TableCell><TableCell className="text-sm text-muted-foreground">{item.size ? `${(item.size / 1024).toFixed(item.size > 1024 * 1024 ? 0 : 1)} ${item.size > 1024 * 1024 ? 'MB' : 'KB'}` : '-'}</TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewFile(item)} aria-label={`Visualizar ${item.name}`}><Image className="h-4 w-4 text-primary" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadMutation.mutate({ name: item.name })} disabled={downloadMutation.isPending} aria-label={`Baixar ${item.name}`}><Download className="h-4 w-4 text-primary" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDeleteFile(item); setDeleteServer('todos'); }} aria-label={`Remover ${item.name}`}><Trash2 className="h-4 w-4 text-red-400" /></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}
    <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) setFile(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" />Adicionar imagem</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>Imagem</Label><input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} /><div className="flex items-center gap-3"><Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>Escolher imagem</Button><span className="min-w-0 truncate text-sm text-muted-foreground">{file?.name || 'Nenhum arquivo selecionado'}</span></div></div><div className="space-y-2"><Label>Enviar para</Label><Select value={uploadServer} onValueChange={setUploadServer}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="server_1">Server 1</SelectItem><SelectItem value="server_2">Server 2</SelectItem><SelectItem value="todos">Todos os servidores</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button><Button onClick={() => uploadMutation.mutate()} disabled={!file || uploadMutation.isPending}>{uploadMutation.isPending ? 'Enviando...' : 'Enviar imagem'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(deleteFile)} onOpenChange={(open) => !open && setDeleteFile(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Remover imagem</DialogTitle></DialogHeader><div className="space-y-4 py-2"><p className="text-sm text-muted-foreground">Deseja remover <span className="font-medium text-foreground">{deleteFile?.name}</span>?</p><div className="space-y-2"><Label>Remover de</Label><Select value={deleteServer} onValueChange={setDeleteServer}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os servidores</SelectItem><SelectItem value="server_1">Server 1</SelectItem><SelectItem value="server_2">Server 2</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setDeleteFile(null)}>Cancelar</Button><Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Removendo...' : 'Remover'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(previewFile)} onOpenChange={(open) => !open && setPreviewFile(null)}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle className="truncate pr-6">{previewFile?.name}</DialogTitle></DialogHeader><div className="flex max-h-[70vh] min-h-52 items-center justify-center overflow-hidden rounded-lg bg-secondary/50">{previewFile ? <ArtworkPreview file={previewFile} className="max-h-[70vh] max-w-full object-contain" /> : <div className="flex flex-col items-center gap-2 text-muted-foreground"><ImageOff className="h-8 w-8" /><span>Prévia indisponível</span></div>}</div></DialogContent></Dialog>
  </div>;
}
