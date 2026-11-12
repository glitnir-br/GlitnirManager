import test from 'node:test';
import assert from 'node:assert/strict';
import { executeDelivery } from '../src/lib/delivery-result.js';

test('envio registra sucesso e falha explícita do RCON', async () => {
  const saved = [];
  const persist = async (item) => { saved.push(item); return item; };
  assert.equal((await executeDelivery({ execute: async () => 'item entregue', persist })).status, 'entregue');
  assert.equal((await executeDelivery({ execute: async () => 'error: item inválido', persist })).status, 'falhou');
  assert.deepEqual(saved.map((item) => item.status), ['entregue', 'falhou']);
});
test('sem resposta, desconexão ou falha ao salvar nunca afirma que não houve entrega', async () => {
  const saved = [];
  const persist = async (item) => { saved.push(item); return item; };
  assert.equal((await executeDelivery({ execute: async () => 'Comando executado sem resposta.', persist })).status, 'resultado_incerto');
  assert.equal((await executeDelivery({ execute: async () => { throw new Error('conexão encerrada'); }, persist })).status, 'resultado_incerto');
  assert.equal(saved[1].status, 'resultado_incerto');
  assert.equal((await executeDelivery({ execute: async () => 'entregue', persist: async () => { throw new Error('banco indisponível'); } })).status, 'resultado_incerto');
});
