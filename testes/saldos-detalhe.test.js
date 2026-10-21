// «Como se chega aos saldos» (saldos.js:balancesDetail): o movimento mais
// recente no topo e o mais antigo no fundo, com o saldo de cada linha a ser
// o acumulado até esse movimento, contado por ordem de data.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp } from './arnes.js';

test('o mais recente no topo, o mais antigo no fundo, e o saldo de cada linha é o acumulado até ela', () => {
  const app = carregarApp();
  let corpo = '';
  app.openModal = (t, body) => { corpo = body; return {}; };
  app.db.owners.push(app.normPerson({ id: 'O1', name: 'Ana' }), app.normPerson({ id: 'O2', name: 'Rui' }));
  app.db.properties.push(app.normProp({ id: 'P1', name: 'Casa', ownerIds: ['O1', 'O2'] }));
  const mov = (label, date, amount) => app.db.transactions.push(app.normTx({ kind: 'expense', label, amount, date, propertyId: 'P1', paidBy: 'O1' }));
  mov('Meio', '2026-02-01', 20);
  mov('Primeiro', '2026-01-01', 10);
  mov('Último', '2026-03-01', 40);
  app.balancesDetail('P1');
  const ordem = ['Último', 'Meio', 'Primeiro'].map((l) => corpo.indexOf('>' + l + '<'));
  assert.ok(ordem.every((i) => i > -1), 'as três linhas');
  assert.deepEqual(ordem.slice().sort((a, b) => a - b), ordem, 'do mais recente para o mais antigo');
  // a Ana paga e fica com metade a receber: 5, depois 15, depois 35 — por data, de baixo para cima
  const saldos = [...corpo.matchAll(/Ana <b[^>]*>[^<]*<\/b> · saldo ([^<]+)<\/span>/g)].map((m) => m[1].replace(/\s/g, ' '));
  assert.deepEqual(saldos, [app.euro2(35), app.euro2(15), app.euro2(5)].map((s) => s.replace(/\s/g, ' ')));
});
