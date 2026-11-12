import { readFile, writeFile } from 'node:fs/promises';

const input = process.argv[2] || 'docs/prefabs-glitnir-awakening.md';
const output = process.argv[3] || 'src/data/awakening-item-catalog.json';
const markdown = await readFile(input, 'utf8');
// Retain metadata for prefabs that remain in the document; membership comes only from it.
const previous = JSON.parse(await readFile(output, 'utf8').catch((error) => {
  if (error.code === 'ENOENT') return '{}';
  throw error;
}));
const catalog = {};
let section = '';
for (const line of markdown.split(/\r?\n/)) {
  if (line.startsWith('## ')) section = line.slice(3).replace(/\s+\(\d+\)$/, '');
  const match = line.match(/^- `([^`]+)`$/);
  if (!match) continue;
  const prefab = match[1];
  if (Object.hasOwn(catalog, prefab)) throw new Error(`Prefab duplicado: ${prefab}`);
  const item = previous[prefab];
  catalog[prefab] = {
    prefab,
    ...(item?.english ? { english: item.english } : {}),
    ...(item?.token ? { token: item.token } : {}),
    ...(item?.maxQuality ? { maxQuality: item.maxQuality } : {}),
    ...(item?.maxStackSize ? { maxStackSize: item.maxStackSize } : {}),
    ...(item?.weight != null ? { weight: item.weight } : {}),
    source: section,
    sendable: /^[A-Za-z0-9_]+$/.test(prefab),
  };
}
if (!Object.keys(catalog).length) throw new Error('Nenhum prefab encontrado no documento.');
await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`${Object.keys(catalog).length} prefabs gerados em ${output}.`);
