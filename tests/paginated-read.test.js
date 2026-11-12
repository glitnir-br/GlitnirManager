import test from 'node:test';
import assert from 'node:assert/strict';
import { paginatedRead } from '../src/api/paginatedRead.js';

function mockClient(rows, cap = 1000) {
  return { from() { let filtered = rows; return {
    select() { return this; }, eq(key, value) { filtered = filtered.filter((row) => row[key] === value); return this; },
    order() { return this; }, async range(start, end) { return { data: filtered.slice(start, Math.min(end + 1, start + cap)), error: null }; },
  }; } };
}
test('lê todas as páginas mesmo quando o servidor limita a resposta', async () => {
  const records = Array.from({ length: 1251 }, (_, id) => ({ id, server: id % 2 ? 'server_2' : 'server_1' }));
  assert.equal((await paginatedRead(mockClient(records, 200), 'players')).length, 1251);
  assert.equal((await paginatedRead(mockClient(records, 200), 'players', { criteria: { server: 'server_1' } })).length, 626);
  assert.equal((await paginatedRead(mockClient(records), 'players', { limit: 5 })).length, 5);
});
