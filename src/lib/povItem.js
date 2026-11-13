import implicitTexts from '@/data/pov-implicit-pt-br.json';

// pt.gear uses .NET BinaryWriter format version 2.
function gearData(raw) {
  if (!raw) return null;
  try {
    if (raw.length > 32768) throw new Error();
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const view = new DataView(bytes.buffer); let pos = 0;
    const int = () => { const n = view.getInt32(pos, true); pos += 4; return n; };
    const byte = () => { const n = view.getUint8(pos); pos++; return n; };
    const float = () => { const n = view.getFloat32(pos, true); pos += 4; if (!Number.isFinite(n)) throw new Error(); return n; };
    const count = (max) => { const n = int(); if (n < 0 || n > max) throw new Error(); return n; };
    const str = () => { let length = 0; let shift = 0; let b; do { b = byte(); length += (b & 127) * 2 ** shift; shift += 7; if (shift > 35) throw new Error(); } while (b & 128); if (length > 512 || pos + length > bytes.length) throw new Error(); const s = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(pos, pos + length)); pos += length; if (s.length > 128) throw new Error(); return s; };
    if (int() !== 2) throw new Error();
    const guid = str(); const origin = str(); const level = int();
    const affixes = Array.from({ length: count(16) }, () => {
      const id = str(); const revision = int(); const tier = str(); const place = byte() & 1; const target = byte();
      const stats = Array.from({ length: count(8) }, () => { const stat = int(); const form = int(); const value = float(); const rolled = float(); const subjects = Array.from({ length: count(8) }, int); return { stat, form, value, rolled, subjects }; });
      return { id, revision, tier, place, target, stats };
    });
    return { guid, origin, level, affixes };
  } catch { return { error: true }; }
}

export function readPovItem(data = {}) {
  const hasPov = Object.keys(data).some((key) => /^(pt\.|PathOfValheiman\.|valheiman\.)/.test(key));
  if (!hasPov) return null;
  const gear = gearData(data['pt.gear']);
  const implicits = (data['pt.implicit'] || '').split(',').filter(Boolean).map((entry) => {
    const split = entry.indexOf(':'); const id = split < 0 ? entry : entry.slice(0, split); const value = split < 0 ? '' : entry.slice(split + 1);
    return { id, value, text: implicitTexts[id]?.replaceAll('{0}', value) || `${id}: ${value}` };
  });
  const rawSockets = data['pt.sockets'] || '';
  const kinds = /^\d+$/.test(rawSockets) ? 'r'.repeat(Math.min(Number(rawSockets), 3)) : rawSockets;
  const sigils = (data['pt.sigils'] || '').split('|');
  const sockets = [...kinds].map((kind, i) => ({ kind: ({ r: 'Rúnico', c: 'Corrompido', d: 'Divino', p: 'Fantasma' })[kind] || kind, sigil: sigils[i] || 'Vazio' }));
  return { gear, implicits, sockets, rarity: data['pt.rarity'] || null, identified: !Object.hasOwn(data, 'pt.unid'), corrupted: Object.hasOwn(data, 'pt.corrupt') ? true : null, influences: (data['pt.influence'] || '').split(',').map((s) => s.trim()).filter(Boolean), treasure: Object.fromEntries(Object.entries(data).filter(([k]) => k.startsWith('pt.tmap.'))) };
}
