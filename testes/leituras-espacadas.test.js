// As leituras do estado ao servidor gastam a base (a D1 lê as linhas todas,
// mesmo quando responde 304). Com o separador escondido o ciclo só envia; e
// com a app parada as leituras espaçam-se — de 3 em 3 minutos com alguém a
// usá-la, de 10 em 10 depois de 10 minutos parada, de 30 em 30 depois de uma
// hora. O primeiro toque volta ao ritmo normal.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, repor } from './arnes.js';

const app = carregarTudo({ hoje: '2026-10-11' });
const MIN = 60000;

describe('o ciclo de sincronização', () => {
  let lidas;
  beforeEach(() => {
    lidas = 0;
    app.CW.user = { id: 'u1', name: 'Ana', email: 'ana@teste.local' };
    app.CW.trancado = false;
    app.pushNow = () => Promise.resolve();
    app.pullNow = () => { lidas++; return Promise.resolve(); };
    app.document.hidden = false;
  });
  afterEach(() => repor(app));
  afterEach(() => { app.document.hidden = false; });

  // corre um ciclo e espera pelo then do envio
  const ciclo = async () => { app.syncCycle(); await new Promise((r) => setImmediate(r)); };

  test('com alguém a usar a app, lê passados os 3 minutos', async () => {
    app.marcarAtividade();
    app.lastPull = app.Date.now() - 4 * MIN;
    await ciclo();
    assert.equal(lidas, 1);
  });

  test('com o separador escondido, só envia: não lê, por mais tempo que tenha passado', async () => {
    app.document.hidden = true;
    app.lastPull = app.Date.now() - 60 * MIN;
    await ciclo();
    assert.equal(lidas, 0);
  });

  test('parada há mais de 10 minutos, a leitura espera 10; há mais de uma hora, espera 30', () => {
    const agora = app.Date.now();
    app.ultimaAtividade = agora - 5 * MIN;
    assert.equal(app.intervaloDeLeitura(agora), app.PULL_MS, 'a uso: os 3 minutos');
    app.ultimaAtividade = agora - 11 * MIN;
    assert.equal(app.intervaloDeLeitura(agora), 10 * MIN);
    app.ultimaAtividade = agora - 61 * MIN;
    assert.equal(app.intervaloDeLeitura(agora), 30 * MIN);
  });

  test('parada, uma leitura de há 4 minutos não se repete; o primeiro toque volta a ler', async () => {
    app.ultimaAtividade = app.Date.now() - 20 * MIN;
    app.lastPull = app.Date.now() - 4 * MIN;
    await ciclo();
    assert.equal(lidas, 0, 'parada há 20 minutos: lê de 10 em 10');
    app.marcarAtividade();
    await ciclo();
    assert.equal(lidas, 1, 'com um toque, os 4 minutos já passaram dos 3');
  });
});
