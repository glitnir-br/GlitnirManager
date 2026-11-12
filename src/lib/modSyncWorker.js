const ROOTS = { plugins: '/BepInEx/plugins', whitelist: '/BepInEx/config/AzuAntiCheat/Whitelist', greylist: '/BepInEx/config/AzuAntiCheat/Greylist' };
const safeName = (name) => typeof name === 'string' && name.length > 0 && name.length <= 255 && !/[\\/\x00-\x1f]/.test(name) && name !== '.' && name !== '..';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function initialModTasks() {
  return ['server_1', 'server_2'].flatMap((server) => Object.keys(ROOTS).map((category) => ({ type: 'root', server, category })));
}

async function retryRead(ptero, server, path, text, timing) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (timing.now() + 16000 >= timing.deadline) throw Object.assign(new Error('Tempo da execução atingido.'), { code: 'BUDGET' });
    try { return await ptero(server, path, text); }
    catch (error) {
      if (error.status !== 429 || attempt === 3) throw error;
      await wait(Math.min(10, error.retryAfter || 2 ** (attempt + 1)) * 1000);
    }
  }
}

async function inspectFolder(task, ptero, timing) {
  const { server, category, folder } = task;
  const root = `${ROOTS[category]}/${folder}`;
  const base = { server, category, folder, name: folder, version: '' };
  const read = async (path) => {
    const content = await retryRead(ptero, server, `/files/contents?file=${encodeURIComponent(path)}`, true, timing);
    try {
      const data = JSON.parse(content);
      if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 255 || typeof data.version_number !== 'string' || !data.version_number.trim() || data.version_number.length > 100) return { ...base, status: 'invalid' };
      return { ...base, name: data.name.trim(), version: data.version_number.trim(), status: 'ok' };
    } catch { return { ...base, status: 'invalid' }; }
  };
  try { return await read(`${root}/manifest.json`); }
  catch (error) { if (error.status !== 404) throw error; }

  // A missing root manifest is common. Avoid an unbounded walk of asset trees.
  const pending = ['']; let visited = 0; let limited = false;
  while (pending.length && visited < 20) {
    const relative = pending.shift(); visited += 1;
    const directory = `${root}${relative ? `/${relative}` : ''}`;
    const listing = await retryRead(ptero, server, `/files/list?directory=${encodeURIComponent(directory)}`, false, timing);
    const children = (listing.data || []).map((item) => item.attributes || item);
    const manifest = children.find((item) => item.is_file !== false && /^manifest(?:\.json)?$/i.test(item.name));
    if (manifest) return read(`${directory}/${manifest.name}`);
    for (const child of children.filter((item) => item.is_file === false && safeName(item.name))) {
      const next = relative ? `${relative}/${child.name}` : child.name;
      if (next.split('/').length <= 4 && next.length <= 1000) pending.push(next); else limited = true;
    }
  }
  return { ...base, status: limited || pending.length ? 'incomplete' : 'missing' };
}

export async function processModTask(task, ptero, timing = { now: Date.now, deadline: Infinity }) {
  const { server, category } = task;
  if (task.type === 'folder') {
    const localDeadline = Math.min(timing.deadline, timing.now() + 45000);
    try { return { entries: [await inspectFolder(task, ptero, { ...timing, deadline: localDeadline })], tasks: [] }; }
    catch (error) {
      if (error.code === 'BUDGET' && localDeadline < timing.deadline) return { entries: [{ server, category, folder: task.folder, name: task.folder, version: '', status: 'incomplete' }], tasks: [] };
      throw error;
    }
  }
  const listing = await retryRead(ptero, server, `/files/list?directory=${encodeURIComponent(ROOTS[category])}`, false, timing);
  const children = (listing.data || []).map((item) => item.attributes || item).filter((item) => safeName(item.name));
  return {
    tasks: children.filter((item) => item.is_file === false).map((item) => ({ type: 'folder', server, category, folder: item.name })),
    entries: children.filter((item) => item.is_file !== false && /\.dll$/i.test(item.name)).map((item) => ({ server, category, folder: item.name, name: item.name, version: '', status: 'file' })),
  };
}

export async function runModSync({ admin, token, owner, queue, entries, done = 0, ptero, now = Date.now, pause = wait, budgetMs = 250000 }) {
  const deadline = now() + budgetMs;
  const checkpoint = async (values) => {
    const { data, error } = await admin.from('mod_comparison_job').update({ ...values, queue, entries, done, total: done + queue.length, updated_at: new Date().toISOString() }).eq('id', true).eq('token', token).eq('status', 'running').select('status').maybeSingle();
    if (error) throw error;
    return Boolean(data);
  };
  try {
    while (queue.length && now() < deadline) {
      const { data: active, error: lockError } = await admin.rpc('mod_comparison_touch', { p_token: token, p_owner: owner });
      if (lockError) throw lockError;
      if (!active || !(await checkpoint({ stage: 'Consultando manifests' }))) return;
      const batch = queue.slice(0, 2);
      const results = await Promise.all(batch.map((task) => processModTask(task, ptero, { deadline, now })));
      queue.splice(0, batch.length); done += batch.length;
      for (const result of results) { entries.push(...result.entries); queue.push(...result.tasks); }
      if (!(await checkpoint({ stage: queue[0]?.type === 'root' ? 'Consultando pastas' : 'Consultando manifests' }))) return;
      await pause(200);
    }
    if (queue.length) { await checkpoint({ status: 'paused', stage: 'Pausada', message: 'O tempo desta execução terminou. Clique em Continuar para retomar do ponto salvo.' }); return; }
    const { error } = await admin.rpc('mod_comparison_finish_job', { p_token: token, p_owner: owner, p_entries: entries });
    if (error) throw error;
  } catch (error) {
    if (error.code === 'BUDGET') await checkpoint({ status: 'paused', stage: 'Pausada', message: 'O tempo desta execução terminou. Clique em Continuar para retomar do ponto salvo.' }).catch(() => {});
    else await checkpoint({ status: 'failed', stage: 'Falhou', message: error.message || 'Falha na sincronização.' }).catch(() => {});
  } finally {
    await admin.rpc('mod_comparison_release', { p_token: token, p_owner: owner }).catch(() => {});
  }
}
