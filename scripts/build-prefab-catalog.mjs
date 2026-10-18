import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [inputFile, outputFile = 'src/data/glitnir-prefab-catalog.json'] = process.argv.slice(2);

if (!inputFile) {
  throw new Error('Uso: node scripts/build-prefab-catalog.mjs <scene-*-registry.csv> [arquivo-de-saida]');
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value); value = '';
    } else value += character;
  }
  values.push(value);
  return values;
}

const contents = await readFile(resolve(inputFile), 'utf8');
const rows = contents.trim().split(/\r?\n/);
const [header, ...body] = rows;
if (header !== 'hash,name,source,calculated_hash') throw new Error('CSV de registro de prefabs inválido.');

const catalog = {};
for (const line of body) {
  const [hash, prefab] = parseCsvLine(line);
  if (!Number.isInteger(Number(hash)) || !prefab) continue;
  catalog[hash] = { prefab, english: prefab };
}

const destination = resolve(outputFile);
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`Catálogo gerado: ${Object.keys(catalog).length} prefabs em ${destination}`);
