// O subtítulo dos Contratos diz o estado deles, e não a descrição do
// separador: «4 em vigor · 1 a acabar · 1 por começar»
// (lista-contratos.js:resumoDosContratos, navegacao.js:subtituloDoEcra). «A
// acabar» é um contrato em vigor que acaba nos próximos 180 dias, o mesmo
// prazo do selo «faltam N dias» (lista-contratos.js:ctSeloDoEstado). Sem
// contratos fica a descrição. No telemóvel o subtítulo vê-se por baixo do
// nome da área, numa linha (estilos.css: header.top .sub), o pedido do
// Martinho no KAN-22.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarTudo, limpar, repor } from './arnes.js';

const app = carregarTudo({ hoje: '2026-11-13' });
afterEach(() => repor(app));

/* Um contrato com o mínimo para o estado.
   Recebe: id; start; end (opcional); active (opcional).
   Devolve: o contrato. */
const ct = (id, start, end, active) => ({ id, propertyId: 'P1', tenantIds: [], rent: 500, start, end: end || '', active: active !== false });

describe('o subtítulo dos Contratos', () => {
  test('conta os em vigor, os que acabam em meio ano e os por começar', () => {
    limpar(app);
    app.db.contracts = [
      ct('C1', '2025-01-01', '2028-01-01'),
      ct('C2', '2025-01-01', '2027-09-01'),
      ct('C3', '2025-01-01', '2026-12-31'),
      ct('C4', '2025-01-01'),
      ct('C5', '2027-02-01', '2029-01-31'),
      ct('C6', '2020-01-01', '2021-01-01'),
    ];
    assert.equal(app.resumoDosContratos(), '4 em vigor · 1 a acabar · 1 por começar');
    app.tab = 'contracts';
    const meta = app.TABS.find((t) => t.id === 'contracts');
    assert.equal(app.subtituloDoEcra(meta), '4 em vigor · 1 a acabar · 1 por começar');
  });

  test('só diz o que há: sem a acabar nem por começar, só os em vigor', () => {
    limpar(app);
    app.db.contracts = [ct('C1', '2025-01-01', '2028-01-01'), ct('C2', '2025-01-01')];
    assert.equal(app.resumoDosContratos(), '2 em vigor');
  });

  test('sem nenhum vivo (ou sem contratos) fica a descrição do separador', () => {
    limpar(app);
    app.db.contracts = [ct('C6', '2020-01-01', '2021-01-01')];
    assert.equal(app.resumoDosContratos(), '');
    app.tab = 'contracts';
    const meta = app.TABS.find((t) => t.id === 'contracts');
    assert.equal(app.subtituloDoEcra(meta), meta.sub);
  });

  test('no telemóvel o subtítulo vê-se, numa linha', () => {
    const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const tel = css.slice(css.indexOf('@media(max-width:900px){\n  aside{'));
    const bloco = tel.slice(0, tel.indexOf('\n}'));
    assert.doesNotMatch(bloco, /header\.top \.sub\{display:none\}/, 'o subtítulo deixou de se esconder');
    assert.match(bloco, /header\.top \.sub\{[^}]*white-space:nowrap[^}]*text-overflow:ellipsis/, 'numa linha, com reticências');
  });
});
