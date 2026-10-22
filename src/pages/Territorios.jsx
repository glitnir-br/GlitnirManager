import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, FilePlus2, MapPinned, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/api/dbClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SIMPLE_FLAGS = [
  ['PvpOnly', 'Somente PvP'], ['PveOnly', 'Somente PvE'], ['NoAttack', 'Sem combate'], ['NoMonsters', 'Sem monstros'],
  ['NoBuild', 'Sem construção'], ['NoBuildDamage', 'Construções indestrutíveis'], ['NoStructureSupport', 'Sem suporte estrutural'],
  ['NoPickaxe', 'Sem picareta'], ['PushAway', 'Expulsar ao entrar'], ['NoInteract', 'Sem interação'],
  ['NoInteractItems', 'Sem itens no chão'], ['NoInteractCraftingStation', 'Sem estações'], ['NoInteractItemStands', 'Sem suportes de item'],
  ['NoInteractChests', 'Sem baús'], ['NoInteractDoors', 'Sem portas'], ['NoInteractPortals', 'Sem interagir com portais'],
  ['NoPortals', 'Portais desativados'], ['NoDeathPenalty', 'Sem penalidade de morte'], ['InfiniteFuel', 'Combustível infinito'],
  ['NoItemLoss', 'Sem perda de itens'], ['SnowMask', 'Remover neve visual'], ['NoMist', 'Sem névoa'],
  ['InfiniteEitr', 'Eitr infinito'], ['InfiniteStamina', 'Stamina infinita'], ['GodMode', 'Invencível'], ['RevealOnMap', 'Revelar no mapa'],
];

const VALUE_FLAGS = [
  ['PeriodicHeal', 'Cura periódica'], ['PeriodicHealALL', 'Cura periódica total'], ['PeriodicDamage', 'Dano periódico'],
  ['MonstersAddStars', 'Estrelas extras'], ['IncreasedPlayerDamage', 'Dano do jogador'], ['IncreasedMonsterDamage', 'Dano dos monstros'],
  ['MoveSpeedMultiplier', 'Velocidade'], ['DropMultiplier', 'Drops'], ['ForceWind', 'Vento'], ['ForceBiome', 'Bioma'],
  ['CustomEnvironment', 'Clima'], ['ForceGroundHeight', 'Altura fixa'], ['AddGroundHeight', 'Adicionar altura'],
  ['LimitZoneHeight', 'Limitar altura'], ['CustomPaint', 'Pintura do solo (0-3)'], ['OnlyForGuild', 'Guilda permitida'],
  ['OnlyForFaction', 'Facção permitida'], ['JoinOtherServer', 'Outro servidor'], ['ZoneMusic', 'Música'],
  ['CustomJereSpawner', 'Spawner customizado'],
];

const DIRECTIONS = ['', 'FromCenter', 'ToCenter', 'LeftRight', 'RightLeft', 'TopBottom', 'BottomTop', 'TopLeftBottomRight', 'TopRightBottomLeft', 'BottomLeftTopRight', 'BottomRightTopLeft'];
const emptyForm = (file = '') => ({ file, name: '', priority: '1', shape: 'Circle', x1: '', y1: '', x2: '', y2: '', radius: '', color1: '#64c864', useColor2: false, color2: '#ffffff', waterVisible: true, direction: '', exponent: '', heightMin: '', heightMax: '', appearanceExtra: '', simpleFlags: [], valueFlags: {}, extraFlags: '', accessPublic: true, access: '' });
const rgb = (hex) => [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((part) => parseInt(part, 16)).join(', ');
const hex = (values, fallback) => values.length === 3 ? `#${values.map((value) => Math.max(0, Math.min(255, Number(value))).toString(16).padStart(2, '0')).join('')}` : fallback;

async function api(body) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch('/api/server-files', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Falha ao gerenciar territórios.');
  return result;
}

function splitBlocks(content, file) {
  const matches = [...content.matchAll(/^\[[^\]\r\n]+\]\s*$/gm)];
  return matches.map((match, index) => {
    const raw = content.slice(match.index, matches[index + 1]?.index ?? content.length).trimEnd();
    return { ...parseBlock(raw, file), raw, content };
  });
}

function parseBlock(raw, file) {
  const lines = raw.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const header = lines[0]?.match(/^\[(.*)\]$/)?.[1] || '';
  const priority = header.match(/^(.*)@(\d+)$/);
  const shape = lines[1] || 'Circle';
  const coordinates = (lines[2] || '').split(',').map((value) => value.trim());
  const appearance = (lines[3] || '').split(',').map((value) => value.trim()).filter(Boolean);
  const leadingNumbers = [];
  while (appearance.length && /^-?\d+(?:\.\d+)?$/.test(appearance[0]) && leadingNumbers.length < 6) leadingNumbers.push(appearance.shift());
  const water = appearance.find((value) => /^(true|false)$/i.test(value));
  const direction = appearance.find((value) => DIRECTIONS.includes(value)) || '';
  const exponent = appearance.find((value) => /^exp\s*:/i.test(value))?.split(':').slice(1).join(':').trim() || '';
  const bounds = appearance.find((value) => /^heightbounds\s*:/i.test(value))?.split(':').slice(1).join(':').trim().split('-') || [];
  const knownAppearance = (value) => /^(true|false)$/i.test(value) || DIRECTIONS.includes(value) || /^exp\s*:/i.test(value) || /^heightbounds\s*:/i.test(value);
  const simpleFlags = [];
  const valueFlags = {};
  const extraFlags = [];
  for (const part of (lines[4] || '').split(',').map((value) => value.trim()).filter(Boolean)) {
    const valued = part.match(/^([^=]+?)\s*=\s*(.*)$/);
    if (valued && VALUE_FLAGS.some(([key]) => key === valued[1].trim())) valueFlags[valued[1].trim()] = valued[2].trim();
    else if (SIMPLE_FLAGS.some(([key]) => key === part)) simpleFlags.push(part);
    else if (part !== 'None') extraFlags.push(part);
  }
  return { ...emptyForm(file.replace(/\.cfg$/i, '')), name: priority?.[1] || header, priority: priority?.[2] || '1', shape, x1: coordinates[0] || '', y1: coordinates[1] || '', radius: shape === 'Rectangle' ? '' : coordinates[2] || '', x2: shape === 'Rectangle' ? coordinates[2] || '' : '', y2: shape === 'Rectangle' ? coordinates[3] || '' : '', color1: hex(leadingNumbers.slice(0, 3), '#64c864'), useColor2: leadingNumbers.length >= 6, color2: hex(leadingNumbers.slice(3, 6), '#ffffff'), waterVisible: water ? water.toLowerCase() === 'true' : true, direction, exponent, heightMin: bounds[0] || '', heightMax: bounds[1] || '', appearanceExtra: appearance.filter((value) => !knownAppearance(value)).join(', '), simpleFlags, valueFlags, extraFlags: extraFlags.join(', '), accessPublic: !lines[5] || lines[5] === 'None', access: !lines[5] || lines[5] === 'None' ? '' : lines[5] };
}

function serialize(form) {
  const coordinates = form.shape === 'Rectangle' ? `${form.x1}, ${form.y1}, ${form.x2}, ${form.y2}` : `${form.x1}, ${form.y1}, ${form.radius}`;
  const appearance = [rgb(form.color1), form.useColor2 ? rgb(form.color2) : '', String(form.waterVisible), form.direction, form.exponent ? `exp: ${form.exponent}` : '', form.heightMin !== '' && form.heightMax !== '' ? `heightbounds: ${form.heightMin}-${form.heightMax}` : '', form.appearanceExtra].filter(Boolean).join(', ');
  const flags = [...form.simpleFlags, ...Object.entries(form.valueFlags).filter(([, value]) => String(value).trim()).map(([key, value]) => `${key} = ${String(value).trim()}`), ...form.extraFlags.split(',').map((value) => value.trim()).filter(Boolean)].join(', ') || 'None';
  return `[${form.name}${form.priority ? `@${form.priority}` : ''}]\n${form.shape}\n${coordinates}\n${appearance}\n${flags}\n${form.accessPublic ? 'None' : form.access.trim()}`;
}

export default function Territorios() {
  const queryClient = useQueryClient();
  const [server, setServer] = useState('server_1');
  const [form, setForm] = useState(emptyForm());
  const [source, setSource] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [message, setMessage] = useState('');
  const query = useQuery({ queryKey: ['territories', server], queryFn: () => api({ action: 'territory-list', server }) });
  const files = query.data?.files || [];
  const groups = useMemo(() => files.map((file) => ({ ...file, blocks: splitBlocks(file.content, file.name) })), [files]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['territories'] });

  const save = useMutation({ mutationFn: async () => {
    const filename = `${(form.file || form.name).trim().replace(/\.cfg$/i, '')}.cfg`;
    const existing = files.find((file) => file.name === filename);
    const duplicate = splitBlocks(existing?.content || '', filename).some((block) => block.name === form.name && block.raw !== source?.raw);
    if (duplicate) throw new Error('Já existe um bloco com este nome neste arquivo.');
    const block = serialize(form);
    const content = source ? source.content.replace(source.raw, block) : existing ? `${existing.content.trimEnd()}\n\n${block}\n` : `${block}\n`;
    return api({ action: 'territory-write-file', server, file: filename, content });
  }, onSuccess: () => { setDialogOpen(false); setMessage(source ? 'Território alterado com sucesso.' : 'Território adicionado com sucesso.'); refresh(); }, onError: (error) => setMessage(error.message) });

  const remove = useMutation({ mutationFn: async (block) => {
    const remaining = block.content.replace(block.raw, '').trim();
    return splitBlocks(remaining, block.file).length ? api({ action: 'territory-write-file', server, file: block.file, content: `${remaining}\n` }) : api({ action: 'territory-delete-file', server, file: block.file });
  }, onSuccess: () => { setMessage('Território removido; os demais blocos foram preservados.'); refresh(); }, onError: (error) => setMessage(error.message) });

  const openAdd = (file = '') => { setSource(null); setForm(emptyForm(file.replace(/\.cfg$/i, ''))); setDialogOpen(true); };
  const openEdit = (block) => { setSource(block); setForm(parseBlock(block.raw, block.file)); setDialogOpen(true); };
  const confirmSave = () => window.confirm(source ? `Confirmar alterações em "${form.name}"?` : `Adicionar "${form.name}" ao arquivo ${form.file || form.name}.cfg?`) && save.mutate();
  const confirmRemove = (block, onlyBlock) => window.confirm(onlyBlock ? `Remover "${block.name}"? Como é o último bloco, o arquivo ${block.file} também será apagado.` : `Remover somente o bloco "${block.name}" de ${block.file}?`) && remove.mutate(block);
  const valid = form.name.trim() && form.x1 !== '' && form.y1 !== '' && (form.shape === 'Rectangle' ? form.x2 !== '' && form.y2 !== '' : form.radius !== '') && (form.accessPublic || form.access.trim());

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><MapPinned className="text-primary" />Territórios</h1><p className="text-sm text-muted-foreground">Arquivos e blocos em Marketplace/Configs/Territories.</p></div><div className="flex gap-2"><Select value={server} onValueChange={setServer}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="server_1">Server 1</SelectItem><SelectItem value="server_2">Server 2</SelectItem></SelectContent></Select><Button variant="outline" onClick={() => openAdd()}><FilePlus2 className="mr-2 h-4 w-4" />Novo arquivo</Button></div></div>
    {message && <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{message}</div>}
    <div className="space-y-4">{groups.map((group) => { const isOpen = expanded[group.name] !== false; return <Card key={group.name}><CardHeader className="flex-row items-center justify-between gap-3"><button className="flex min-w-0 items-center gap-2 text-left" onClick={() => setExpanded((current) => ({ ...current, [group.name]: !isOpen }))}>{isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}<div><CardTitle className="truncate">{group.name}</CardTitle><p className="text-xs text-muted-foreground">{group.blocks.length} território(s)</p></div></button><Button size="sm" onClick={() => openAdd(group.name)}><Plus className="mr-1 h-4 w-4" />Adicionar bloco</Button></CardHeader>{isOpen && <CardContent className="space-y-2">{group.blocks.map((block) => <div key={`${group.name}-${block.name}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{block.name}</p><p className="text-xs text-muted-foreground">{block.shape} · prioridade {block.priority}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openEdit(block)}><Pencil className="mr-1 h-4 w-4" />Editar</Button><Button size="sm" variant="destructive" onClick={() => confirmRemove(block, group.blocks.length === 1)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</CardContent>}</Card>; })}{!groups.length && !query.isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum arquivo encontrado neste servidor.</CardContent></Card>}</div>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>{source ? 'Editar território' : 'Adicionar território'}</DialogTitle></DialogHeader><div className="grid gap-5 lg:grid-cols-2"><div className="space-y-4"><div><Label>Arquivo</Label><Input value={form.file} disabled={Boolean(source) || Boolean(form.file && files.some((file) => file.name === `${form.file}.cfg`))} onChange={(event) => setForm({ ...form, file: event.target.value })} placeholder="Nome do arquivo" /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Nome do território</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div><Label>Prioridade</Label><Input type="number" min="1" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /></div></div><div><Label>Formato</Label><Select value={form.shape} onValueChange={(shape) => setForm({ ...form, shape })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Circle">Círculo</SelectItem><SelectItem value="Square">Quadrado</SelectItem><SelectItem value="Rectangle">Retângulo</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><Input placeholder="X" value={form.x1} onChange={(event) => setForm({ ...form, x1: event.target.value })} /><Input placeholder="Y" value={form.y1} onChange={(event) => setForm({ ...form, y1: event.target.value })} />{form.shape === 'Rectangle' ? <><Input placeholder="X2" value={form.x2} onChange={(event) => setForm({ ...form, x2: event.target.value })} /><Input placeholder="Y2" value={form.y2} onChange={(event) => setForm({ ...form, y2: event.target.value })} /></> : <Input placeholder="Raio" value={form.radius} onChange={(event) => setForm({ ...form, radius: event.target.value })} />}</div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Cor principal</Label><Input type="color" value={form.color1} onChange={(event) => setForm({ ...form, color1: event.target.value })} /></div><label className="flex items-end gap-2 pb-2 text-sm"><Checkbox checked={form.useColor2} onCheckedChange={(checked) => setForm({ ...form, useColor2: Boolean(checked) })} />Usar segunda cor</label>{form.useColor2 && <div><Label>Segunda cor</Label><Input type="color" value={form.color2} onChange={(event) => setForm({ ...form, color2: event.target.value })} /></div>}<div><Label>Água fora da zona</Label><Select value={String(form.waterVisible)} onValueChange={(value) => setForm({ ...form, waterVisible: value === 'true' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">Visível</SelectItem><SelectItem value="false">Oculta</SelectItem></SelectContent></Select></div></div><div className="grid gap-3 sm:grid-cols-2"><Select value={form.direction || 'none'} onValueChange={(value) => setForm({ ...form, direction: value === 'none' ? '' : value })}><SelectTrigger><SelectValue placeholder="Direção do gradiente" /></SelectTrigger><SelectContent>{DIRECTIONS.map((value) => <SelectItem key={value || 'none'} value={value || 'none'}>{value || 'Sem direção'}</SelectItem>)}</SelectContent></Select><Input placeholder="Exp. do gradiente" value={form.exponent} onChange={(event) => setForm({ ...form, exponent: event.target.value })} /><Input placeholder="Altura mínima" value={form.heightMin} onChange={(event) => setForm({ ...form, heightMin: event.target.value })} /><Input placeholder="Altura máxima" value={form.heightMax} onChange={(event) => setForm({ ...form, heightMax: event.target.value })} /></div><Input placeholder="Aparência extra" value={form.appearanceExtra} onChange={(event) => setForm({ ...form, appearanceExtra: event.target.value })} /><div className="rounded-lg border p-3"><div className="flex items-center justify-between"><Label>Acesso</Label><Button size="sm" variant="outline" onClick={() => setForm({ ...form, accessPublic: !form.accessPublic })}>{form.accessPublic ? 'Público' : 'Exclusivo'}</Button></div>{!form.accessPublic && <Input className="mt-3" placeholder="Steam IDs, jogadores ou cargos separados por vírgula" value={form.access} onChange={(event) => setForm({ ...form, access: event.target.value })} />}</div></div><div className="space-y-4"><div><Label>Flags simples</Label><div className="mt-2 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto rounded-lg border p-3">{SIMPLE_FLAGS.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs"><Checkbox checked={form.simpleFlags.includes(key)} onCheckedChange={(checked) => setForm((current) => ({ ...current, simpleFlags: checked ? [...current.simpleFlags, key] : current.simpleFlags.filter((value) => value !== key) }))} /><span>{label}<small className="block text-muted-foreground">{key}</small></span></label>)}</div></div><div><Label>Flags com valor</Label><div className="mt-2 grid gap-2 sm:grid-cols-2">{VALUE_FLAGS.map(([key, label]) => { const enabled = Object.hasOwn(form.valueFlags, key); return <div key={key} className="flex items-center gap-2"><Checkbox checked={enabled} onCheckedChange={(checked) => setForm((current) => { const valueFlags = { ...current.valueFlags }; if (checked) valueFlags[key] = ''; else delete valueFlags[key]; return { ...current, valueFlags }; })} /><Input disabled={!enabled} placeholder={label} value={form.valueFlags[key] || ''} onChange={(event) => setForm((current) => ({ ...current, valueFlags: { ...current.valueFlags, [key]: event.target.value } }))} /></div>; })}</div></div><div><Label>Flags extras</Label><Input value={form.extraFlags} onChange={(event) => setForm({ ...form, extraFlags: event.target.value })} placeholder="Separadas por vírgula" /></div><div><Label>Prévia</Label><pre className="mt-2 max-h-52 overflow-auto rounded-lg bg-secondary p-3 text-xs">{serialize(form)}</pre></div></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button disabled={!valid || save.isPending} onClick={confirmSave}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
