// Na Avaliação, «Partilhar avaliação» e «Exportar movimentos (CSV)» vivem num
// botão só, com o ícone de partilha e o nome «Partilhar», que abre o menu de
// ações da casa (.menupop, aberto pelo menuOpen) com as duas. O botão tem
// 44×44, fica na linha do chip também no telemóvel, e o menu não parte as
// opções em duas linhas.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));
afterEach(() => { app.repProp = ''; });
const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');

/* Dois imóveis com valor, para a Avaliação ter o portefólio à vista. */
function semear() {
  const db = limpar(app);
  app.repProp = '';
  db.owners.push(app.normPerson({ id: 'o1', name: 'Ana' }));
  db.properties.push(app.normProp({ id: 'p1', name: 'T2 Lisboa', value: 200000, purchase: 150000, ownerIds: ['o1'] }));
  db.properties.push(app.normProp({ id: 'p2', name: 'T1 Porto', value: 120000, purchase: 90000, ownerIds: ['o1'] }));
}

/* O menu de partilha da página, pelo id.
   Recebe: h — o HTML da vista.
   Devolve: o HTML do .menupop (string), ou '' sem ele. */
function menuDaPartilha(h) {
  const m = h.match(/<div class="menupop" id="menu_avaPartilha">([\s\S]*?)<\/div><\/span>/);
  return m ? m[1] : '';
}

describe('o botão de partilha da Avaliação', () => {
  beforeEach(semear);

  test('um botão só, de ícone, com o nome «Partilhar», que abre o menu', () => {
    const h = app.vReports();
    const b = h.match(/<span class="menuwrap ava-partilha" data-menu="acoes"><button ([^>]*)>([\s\S]*?)<\/button>/);
    assert.ok(b, 'o botão está na fila do chip');
    assert.match(b[1], /^type="button" class="btn so-icone" data-toca="camada" data-click="menuOpen\(event,'avaPartilha'\)" aria-expanded="false" aria-label="Partilhar" title="Partilhar"$/, 'nasce fechado, como o ⋯ da casa');
    assert.equal(b[2], app.ic('partilhar', 18), 'só o ícone de partilha, sem texto');
    assert.match(h, /<div class="ana-acoes"><span class="menuwrap ava-partilha" data-menu="acoes">/);
    assert.doesNotMatch(h, /ana-largo|ana-curto/, 'os rótulos longo e curto dos dois botões saíram');
  });

  test('o menu tem as duas ações, por esta ordem, cada uma fecha o menu e corre', () => {
    const m = menuDaPartilha(app.vReports());
    const itens = [...m.matchAll(/<button type="button" data-toca="nada" data-click="([^"]*)">(<svg[\s\S]*?<\/svg>) ([^<]*)<\/button>/g)];
    assert.deepEqual(itens.map((i) => [i[1], i[3]]), [
      ['closePops();shareReport()', 'Partilhar avaliação'],
      ['closePops();downloadCsv()', 'Exportar movimentos (CSV)'],
    ]);
    assert.equal(itens[0][2], app.ic('partilhar', 17));
    assert.equal(itens[1][2], app.ic('down', 17));
    for (const [, act] of itens) assert.doesNotThrow(() => app.analisarAcao(act), act);
    assert.doesNotThrow(() => app.analisarAcao("menuOpen(event,'avaPartilha')"));
  });

  test('cada ação aparece uma vez na página: só no menu', () => {
    const h = app.vReports();
    assert.equal((h.match(/shareReport\(\)/g) || []).length, 1);
    assert.equal((h.match(/downloadCsv\(\)/g) || []).length, 1);
    assert.equal((h.match(/id="menu_avaPartilha"/g) || []).length, 1);
  });

  test('com um imóvel só (a ficha dele) o botão continua; sem imóveis não há o que partilhar', () => {
    app.db.properties.pop();
    assert.match(app.vReports(), /aria-label="Partilhar"/);
    app.db.properties.length = 0;
    const h = app.vReports();
    assert.doesNotMatch(h, /menu_avaPartilha|aria-label="Partilhar"/);
  });

  test('o ícone de partilha: os três pontos ligados, no traço da casa', () => {
    const s = app.ic('partilhar');
    assert.match(s, /stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/);
    assert.equal((s.match(/<circle /g) || []).length, 3, 'três pontos');
    assert.match(s, /<path d="[^"]+"\/>/, 'e as ligações');
    assert.notEqual(s, app.ic('dots'), 'não é o ⋯');
  });
});

describe('os estilos', () => {
  test('a secção da folha: na linha do chip no telemóvel, o menu na largura das opções e sem passar do ecrã', () => {
    const i = css.indexOf('/* ===== ajustes-v40d: 1.5'), f = css.indexOf('/* ===== fim: ajustes-v40d 1.5 ===== */');
    assert.ok(i > -1 && f > i, 'a secção existe');
    const sec = css.slice(i, f);
    assert.match(sec, /@media\(max-width:520px\)\{\.ana-topo>\.ana-acoes\{width:auto\}\}/);
    assert.match(sec, /\.ava-partilha \.menupop\{width:max-content;max-width:calc\(100vw - 32px\)\}/);
    assert.doesNotMatch(sec, /#[0-9a-f]{3,6}\b|rgb\(/i, 'cores só por tokens');
  });

  test('o botão de ícone tem 44×44 (o .btn.so-icone da base)', () => {
    assert.match(css, /\n\.btn\{[^}]*min-height:44px/);
    assert.match(css, /\n\.btn\.so-icone\{width:44px;padding:0\}/);
  });
});
