export const MOD_SOURCES = [
  { key: 'plugins', label: 'Plugins' },
  { key: 'whitelist', label: 'Whitelist' },
  { key: 'greylist', label: 'Greylist' },
];
export const MOD_SERVERS = [
  { key: 'server_1', label: 'Server 1' },
  { key: 'server_2', label: 'Server 2' },
];

export function compareMods(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const key = entry.folder.toLocaleLowerCase('en-US');
    const row = grouped.get(key) || { key, folder: entry.folder, name: entry.name || entry.folder, cells: {} };
    if (entry.name) row.name = entry.name;
    row.cells[`${entry.server}:${entry.category}`] = entry;
    grouped.set(key, row);
  }
  return [...grouped.values()].map((row) => {
    let divergent = false;
    for (const source of MOD_SOURCES) {
      const first = row.cells[`server_1:${source.key}`];
      const second = row.cells[`server_2:${source.key}`];
      if (Boolean(first) !== Boolean(second) || (first?.status === 'ok' && second?.status === 'ok' && first.version !== second.version)) divergent = true;
    }
    return { ...row, divergent };
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
