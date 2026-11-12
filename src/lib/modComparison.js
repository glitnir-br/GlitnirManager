export const MOD_SOURCES = [
  { key: 'plugins', label: 'Plugins' },
  { key: 'whitelist', label: 'Whitelist' },
  { key: 'greylist', label: 'Greylist' },
];
export const MOD_SERVERS = [
  { key: 'server_1', label: 'Server 1' },
  { key: 'server_2', label: 'Server 2' },
];

const hasVersion = (item) => item?.status === 'ok' && typeof item.version === 'string' && Boolean(item.version.trim());

export function assessServer(cells, server) {
  const plugin = cells[`${server}:plugins`];
  const lists = MOD_SOURCES.slice(1).map((source) => ({ ...source, entry: cells[`${server}:${source.key}`] })).filter(({ entry }) => entry);
  if (!plugin && !lists.length) return { status: 'absent', labels: ['Não encontrado neste servidor'], details: [], issue: false };

  const details = [];
  const labels = [];
  if (plugin) details.push({ label: 'Plugins', entry: plugin, tone: hasVersion(plugin) ? 'reference' : 'unknown', description: hasVersion(plugin) ? 'Referência' : 'Versão indisponível' });
  if (!plugin) labels.push('Ausente em Plugins');
  if (plugin && !lists.length) labels.push('Ausente na Whitelist e Greylist');
  let mismatch = false;
  let unknown = Boolean(plugin && !hasVersion(plugin));
  for (const list of lists) {
    let tone; let description;
    if (!plugin) {
      tone = hasVersion(list.entry) ? 'extra' : 'unknown';
      description = hasVersion(list.entry) ? 'Sem referência em Plugins' : 'Versão indisponível';
      if (!hasVersion(list.entry)) unknown = true;
    } else if (!hasVersion(plugin) || !hasVersion(list.entry)) {
      tone = 'unknown'; description = 'Não foi possível comparar'; unknown = true;
    } else if (plugin.version === list.entry.version) {
      tone = 'match'; description = 'Igual a Plugins';
    } else {
      tone = 'mismatch'; description = 'Diferente de Plugins'; mismatch = true;
    }
    details.push({ label: list.label, entry: list.entry, tone, description });
  }
  if (mismatch) labels.push('Versões diferentes');
  if (unknown) labels.push('Versão indisponível para comparação');
  if (!labels.length) labels.push('Versões iguais');
  return { status: mismatch ? 'mismatch' : !plugin || !lists.length ? 'missing' : unknown ? 'unknown' : 'match', labels, details, issue: mismatch || !plugin || !lists.length || unknown };
}

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
    const servers = Object.fromEntries(MOD_SERVERS.map(({ key }) => [key, assessServer(row.cells, key)]));
    return { ...row, servers, divergent: Object.values(servers).some((server) => server.issue) };
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
