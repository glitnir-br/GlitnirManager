import itemCatalog from '@/data/valheim-item-catalog.json';
import modpackCatalog from '@/data/glitnir-prefab-catalog.json';

const textDecoder = new TextDecoder('utf-8', { fatal: true });
const DIFFICULTIES = ['Geral', 'Qualquer', 'Martelo', 'Casual', 'Muito fácil', 'Fácil', 'Normal', 'Difícil', 'Muito difícil', 'Extremo'];
const SKILLS = { 1: 'Espadas', 2: 'Facas', 3: 'Clavas', 4: 'Armas de haste', 5: 'Lanças', 6: 'Bloqueio', 7: 'Machados', 8: 'Arcos', 9: 'Magia de fogo', 10: 'Magia de gelo', 11: 'Desarmado', 12: 'Picaretas', 13: 'Corte de madeira', 14: 'Bestas', 15: 'Magia elemental', 16: 'Magia de sangue', 100: 'Pulo', 101: 'Furtividade', 102: 'Corrida', 103: 'Natação', 104: 'Pesca', 105: 'Montaria' };
const DEATH_STATS = { 56: 'Inimigo', 58: 'Queda', 59: 'Afogamento', 60: 'Fogo', 61: 'Congelamento', 62: 'Veneno', 63: 'Fumaça', 65: 'Limite do mundo', 68: 'Árvore', 71: 'Torreta', 73: 'Estalactite', 105: 'Catapulta', 107: 'Oceano de Ashlands', 108: 'Obliterador', 203: 'Ponte levadiça', 204: 'Lava de Ashlands' };

function stableHash(value) {
  let a = 5381 | 0; let b = 5381 | 0;
  for (let index = 0; index < value.length; index += 2) {
    a = (((a << 5) + a) ^ value.charCodeAt(index)) | 0;
    if (index === value.length - 1) break;
    b = (((b << 5) + b) ^ value.charCodeAt(index + 1)) | 0;
  }
  return (a + Math.imul(b, 1566083941)) | 0;
}

const catalogByHash = new Map(Object.values(itemCatalog).map((item) => [stableHash(item.prefab), item]));
for (const [hash, item] of Object.entries(modpackCatalog)) catalogByHash.set(Number(hash), item);

class Reader {
  constructor(buffer, start = 0, end = buffer.byteLength) { this.view = new DataView(buffer, start, end - start); this.bytes = new Uint8Array(buffer, start, end - start); this.p = 0; }
  ensure(size) { if (this.p + size > this.view.byteLength) throw new Error('O arquivo terminou antes do esperado.'); }
  u8() { this.ensure(1); return this.view.getUint8(this.p++); }
  bool() { return this.u8() !== 0; }
  i32() { this.ensure(4); const value = this.view.getInt32(this.p, true); this.p += 4; return value; }
  u16() { this.ensure(2); const value = this.view.getUint16(this.p, true); this.p += 2; return value; }
  i64() { this.ensure(8); const value = this.view.getBigInt64(this.p, true); this.p += 8; return value.toString(); }
  f32() { this.ensure(4); const value = this.view.getFloat32(this.p, true); this.p += 4; return value; }
  skip(size) { this.ensure(size); this.p += size; }
  string() { let length = 0; let shift = 0; while (true) { const byte = this.u8(); length |= (byte & 0x7f) << shift; if (byte < 0x80) break; shift += 7; if (shift > 28) throw new Error('String inválida no arquivo.'); } this.ensure(length); const value = textDecoder.decode(this.bytes.subarray(this.p, this.p + length)); this.p += length; return value; }
  itemCount() { const first = this.u8(); return first & 0x80 ? ((first & 0x7f) << 8) | this.u8() : first; }
  vector() { return { x: this.f32(), y: this.f32(), z: this.f32() }; }
  stringFloatMap() { const result = {}; const count = this.i32(); if (count < 0 || count > 100000) throw new Error('Tabela inválida no arquivo.'); for (let i = 0; i < count; i += 1) result[this.string()] = this.f32(); return result; }
  stringList() { const count = this.i32(); if (count < 0 || count > 100000) throw new Error('Lista inválida no arquivo.'); return Array.from({ length: count }, () => this.string()); }
}

function readItem(reader) {
  const durability = reader.i32() / 100;
  const position = { x: reader.u8(), y: reader.u8() };
  const worldLevel = reader.u8();
  const flags = reader.u8();
  const quality = flags & 4 ? reader.u16() : 1;
  const stack = flags & 8 ? reader.u16() : 1;
  const variant = flags & 16 ? reader.i32() : 0;
  const crafterId = flags & 32 ? reader.i64() : null;
  const crafterName = flags & 32 ? reader.string() : '';
  const prefabHash = flags & 64 ? reader.i32() : 0;
  const customData = {};
  if (flags & 128) for (let i = 0, count = reader.itemCount(); i < count; i += 1) customData[reader.string()] = reader.string();
  const cheated = reader.bool();
  const catalog = catalogByHash.get(prefabHash);
  return { prefabHash, prefab: catalog?.prefab || '', name: catalog?.english || catalog?.token || catalog?.prefab || `Item desconhecido (${prefabHash})`, stack, durability, quality, variant, position, worldLevel, equipped: Boolean(flags & 2), crafterId, crafterName, cheated, customData, weight: catalog?.weight, maxStack: catalog?.maxStackSize };
}

export function parseFch(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength < 76) throw new Error('Selecione um arquivo .fch válido.');
  const header = new DataView(arrayBuffer);
  const payloadLength = header.getInt32(0, true);
  if (payloadLength <= 0 || payloadLength + 72 > arrayBuffer.byteLength) throw new Error('O tamanho declarado no .fch é inválido.');
  const reader = new Reader(arrayBuffer, 4, 4 + payloadLength);
  const profileVersion = reader.i32();
  if (profileVersion < 46 || profileVersion > 1000) throw new Error(`Versão de perfil ${profileVersion} ainda não suportada.`);
  const statCount = reader.i32(); const setCount = reader.i32();
  if (statCount !== 205 || setCount !== 10) throw new Error(`Estrutura de estatísticas desconhecida (${statCount} × ${setCount}).`);
  const statSets = [];
  for (let setIndex = 0; setIndex < setCount; setIndex += 1) {
    const stats = Array.from({ length: statCount }, () => reader.f32());
    const worlds = reader.stringFloatMap(); const worldKeys = reader.stringFloatMap(); const commands = reader.stringFloatMap();
    const enemyGroups = Array.from({ length: reader.i32() }, () => reader.stringFloatMap());
    statSets.push({ name: DIFFICULTIES[setIndex], stats, worlds, worldKeys, commands, kills: enemyGroups[0] || {}, killGroups: enemyGroups, pickedUp: reader.stringFloatMap(), crafted: reader.stringFloatMap(), pickables: reader.stringFloatMap(), foodsEaten: reader.stringFloatMap(), piecesBuilt: reader.stringFloatMap() });
  }
  const firstSpawn = reader.bool();
  const worlds = Array.from({ length: reader.i32() }, () => {
    const id = reader.i64(); const hasSpawn = reader.bool(); const spawn = reader.vector(); const hasLogout = reader.bool(); const logout = reader.vector(); const hasDeath = reader.bool(); const death = reader.vector(); const home = reader.vector(); const hasMap = reader.bool(); let mapBytes = 0;
    if (hasMap) { mapBytes = reader.i32(); reader.skip(mapBytes); }
    return { id, hasSpawn, spawn, hasLogout, logout, hasDeath, death, home, hasMap, mapBytes };
  });
  const name = reader.string(); const playerId = reader.i64(); const startSeed = reader.string(); const usedCheats = reader.bool(); const createdTicks = reader.i64(); const hasPlayerData = reader.bool();
  const base = { profileVersion, statCount, setCount, statSets, firstSpawn, worlds, name, playerId, startSeed, usedCheats, createdTicks, hasPlayerData };
  if (!hasPlayerData) return base;
  const blobLength = reader.i32(); const blobEnd = reader.p + blobLength; const playerVersion = reader.i32();
  const maxHealth = reader.f32(); const health = reader.f32(); const maxStamina = reader.f32(); const timeSinceDeath = reader.f32(); const guardianPower = reader.string(); const guardianCooldown = reader.f32();
  const inventoryVersion = reader.i32(); const inventory = Array.from({ length: reader.u16() }, () => readItem(reader));
  const recipes = reader.stringList(); const stations = Array.from({ length: reader.i32() }, () => ({ name: reader.string(), level: reader.i32() }));
  const materials = reader.stringList(); const tutorials = reader.stringList(); const uniques = reader.stringList(); const trophies = reader.stringList(); const biomes = reader.stringList();
  const texts = Array.from({ length: reader.i32() }, () => ({ label: reader.string(), text: reader.string() }));
  const beard = reader.string(); const hair = reader.string(); const skinColor = reader.vector(); const hairColor = reader.vector(); const model = reader.i32();
  const foods = Array.from({ length: reader.i32() }, () => ({ name: reader.string(), value: reader.f32() }));
  const skillsVersion = reader.i32(); const skills = Array.from({ length: reader.i32() }, () => { const id = reader.i32(); return { id, name: SKILLS[id] || `Habilidade ${id}`, level: reader.f32(), progress: reader.f32() }; });
  const customData = {}; for (let i = 0, count = reader.i32(); i < count; i += 1) customData[reader.string()] = reader.string();
  const stamina = reader.f32(); const maxEitr = reader.f32(); const eitr = reader.f32(); const buildMenuBytes = reader.i32(); reader.skip(buildMenuBytes);
  const pseudoCounters = Array.from({ length: reader.i32() }, () => ({ key: reader.i32(), value: reader.i32() }));
  const upgradeSeeds = Array.from({ length: reader.i32() }, () => ({ key: reader.i32(), seed: reader.i32() }));
  if (reader.p !== blobEnd) throw new Error(`O bloco do personagem possui ${blobEnd - reader.p} bytes não reconhecidos.`);
  const deathStats = Object.entries(DEATH_STATS).map(([index, label]) => ({ label, value: statSets[1].stats[Number(index)] || 0 })).filter((item) => item.value > 0);
  return { ...base, playerVersion, maxHealth, health, maxStamina, stamina, maxEitr, eitr, timeSinceDeath, guardianPower, guardianCooldown, inventoryVersion, inventory, recipes, stations, materials, tutorials, uniques, trophies, biomes, texts, appearance: { beard, hair, skinColor, hairColor, model }, foods, skillsVersion, skills, customData, buildMenuBytes, pseudoCounters, upgradeSeeds, deathStats };
}
