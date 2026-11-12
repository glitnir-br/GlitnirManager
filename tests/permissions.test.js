import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAllowedPages } from '../src/lib/permissionRules.js';

test('permissões totalmente negadas não voltam às permissões antigas', () => {
  const legacy = { administrador: ['dashboard', 'financeiro'], adm_principal: ['dashboard'] };
  const permissions = [{ role_key: 'administrador', page_key: 'dashboard', allowed: false }];
  assert.deepEqual(resolveAllowedPages('administrador', permissions, legacy), []);
  assert.deepEqual(resolveAllowedPages('administrador', [], legacy, true), []);
  assert.deepEqual(resolveAllowedPages('administrador', [], legacy), ['dashboard', 'financeiro']);
});
