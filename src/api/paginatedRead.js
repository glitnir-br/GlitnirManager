export async function paginatedRead(client, table, { criteria = {}, sortKey, limit } = {}) {
  const rows = [];
  const pageSize = 500;
  while (!limit || rows.length < limit) {
    let query = client.from(table).select('*');
    for (const [key, value] of Object.entries(criteria)) query = query.eq(key, value);
    if (sortKey) query = query.order(sortKey.startsWith('-') ? sortKey.slice(1) : sortKey, { ascending: !sortKey.startsWith('-') });
    if (!sortKey || sortKey.replace(/^-/, '') !== 'id') query = query.order('id', { ascending: true });
    const size = limit ? Math.min(pageSize, limit - rows.length) : pageSize;
    const { data, error } = await query.range(rows.length, rows.length + size - 1);
    if (error) throw new Error(`Falha ao listar ${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
  }
  return rows;
}
