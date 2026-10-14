import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, File, FileCode2, FileImage, Folder, HardDrive, ImageOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/api/dbClient';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
const TEXT_EXTENSIONS = new Set(['txt', 'json', 'yml', 'yaml', 'cfg', 'conf', 'ini', 'log', 'md', 'xml', 'csv', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'sh', 'properties']);

async function requestFiles(body, binary = false) {
  if (!supabase) throw new Error('A conexão com o Supabase é necessária.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre novamente no sistema.');
  const response = await fetch('/api/pterodactyl-files', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  if (binary) {
    if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Não foi possível carregar o arquivo.'); }
    return response.blob();
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Falha ao acessar os arquivos.');
  return result;
}

function formatSize(size) {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function joinPath(path, name) { return path === '/' ? `/${name}` : `${path}/${name}`; }
function extension(name) { return name.split('.').pop()?.toLowerCase() || ''; }

export default function Arquivos() {
  const [server, setServer] = useState('server_1');
  const [path, setPath] = useState('/');
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState({ url: null, text: null, error: '' });
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['pterodactyl-files', server, path], queryFn: () => requestFiles({ action: 'list', server, path }) });
  const breadcrumbs = useMemo(() => path.split('/').filter(Boolean), [path]);

  useEffect(() => () => { if (preview.url) URL.revokeObjectURL(preview.url); }, [preview.url]);

  const openFile = async (item) => {
    const filePath = joinPath(path, item.name);
    if (item.isDirectory) { setPath(filePath); return; }
    const fileExtension = extension(item.name);
    if (!IMAGE_EXTENSIONS.has(fileExtension) && !TEXT_EXTENSIONS.has(fileExtension)) return;
    setSelected({ ...item, path: filePath });
    setPreview({ url: null, text: null, error: '' });
    try {
      const blob = await requestFiles({ action: 'read', server, path: filePath }, true);
      if (IMAGE_EXTENSIONS.has(fileExtension)) setPreview({ url: URL.createObjectURL(blob), text: null, error: '' });
      else setPreview({ url: null, text: await blob.text(), error: '' });
    } catch (previewError) { setPreview({ url: null, text: null, error: previewError.message }); }
  };

  const files = data?.files || [];
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15"><HardDrive className="h-5 w-5 text-primary" /></div><div><h1 className="text-2xl font-bold text-foreground md:text-3xl">Arquivos</h1><p className="mt-0.5 text-sm text-muted-foreground">Navegue pelos arquivos do Pterodactyl</p></div></div><div className="flex gap-2"><Select value={server} onValueChange={(value) => { setServer(value); setPath('/'); }}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="server_1">Server 1</SelectItem><SelectItem value="server_2">Server 2</SelectItem></SelectContent></Select><Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /></Button></div></div>
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"><button type="button" className="rounded px-1.5 py-1 text-primary hover:bg-secondary" onClick={() => setPath('/')}>Raiz</button>{breadcrumbs.map((part, index) => <React.Fragment key={`${part}-${index}`}><ChevronRight className="h-4 w-4 text-muted-foreground" /><button type="button" className="rounded px-1.5 py-1 text-foreground hover:bg-secondary" onClick={() => setPath(`/${breadcrumbs.slice(0, index + 1).join('/')}`)}>{part}</button></React.Fragment>)}</div>
    {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error.message}</div> : <div className="overflow-hidden rounded-xl border border-border bg-card"><div className="grid grid-cols-[minmax(0,1fr)_110px] border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid-cols-[minmax(0,1fr)_120px_180px]"><span>Nome</span><span>Tamanho</span><span className="hidden sm:block">Modificado</span></div>{isLoading ? <div className="py-12 text-center text-muted-foreground">Carregando arquivos...</div> : files.length === 0 ? <div className="py-12 text-center text-muted-foreground">Esta pasta está vazia</div> : files.map((item) => <button type="button" key={item.name} onClick={() => openFile(item)} className="grid w-full grid-cols-[minmax(0,1fr)_110px] items-center border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary/70 sm:grid-cols-[minmax(0,1fr)_120px_180px]"><span className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary">{item.isDirectory ? <Folder className="h-4 w-4 text-amber-400" /> : IMAGE_EXTENSIONS.has(extension(item.name)) ? <FileImage className="h-4 w-4 text-primary" /> : TEXT_EXTENSIONS.has(extension(item.name)) ? <FileCode2 className="h-4 w-4 text-blue-400" /> : <File className="h-4 w-4 text-muted-foreground" />}</span><span className="truncate font-medium text-foreground">{item.name}</span></span><span className="text-sm text-muted-foreground">{item.isDirectory ? '-' : formatSize(item.size)}</span><span className="hidden text-sm text-muted-foreground sm:block">{item.modifiedAt ? new Date(item.modifiedAt).toLocaleString('pt-BR') : '-'}</span></button>)}</div>}
    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle className="truncate pr-6">{selected?.name}</DialogTitle></DialogHeader>{preview.error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{preview.error}</div> : preview.url ? <div className="flex max-h-[70vh] min-h-52 items-center justify-center overflow-auto rounded-lg bg-secondary/50"><img src={preview.url} alt={selected?.name} className="max-h-[70vh] max-w-full object-contain" /></div> : preview.text !== null ? <pre className="max-h-[70vh] overflow-auto rounded-lg bg-secondary p-4 text-xs text-foreground">{preview.text}</pre> : <div className="flex min-h-52 items-center justify-center text-muted-foreground"><ImageOff className="mr-2 h-5 w-5" />Carregando prévia...</div>}</DialogContent></Dialog>
  </div>;
}
