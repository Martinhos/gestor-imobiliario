// A Análise é uma área com abas, como as Casas e o Dinheiro: a Avaliação, as
// Projeções e o IRS · Anexo F no topo do ecrã do telemóvel, com a acesa certa
// (navegacao.js:AREAS, abasDaArea), o nome «Análise» no cabeçalho do telemóvel
// (tituloDoEcraHtml), o carrossel entre as três (vizinhoNaArea), a área a
// lembrar onde se ficou (destinoDe), as portas escondidas por um cargo ou por
// um serviço desligado a saírem da fila; a barra de baixo igual, com quatro
// destinos e nada aceso na Análise (TABBAR); e as apresentações da Análise a
// mostrarem o ecrã como ele é, com o título da área e as abas
// (cloud/apresentacao-analise.js:aprAEcra).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, limpar, repor, elementos, igual } from './arnes.js';

const app = carregarTudo();
afterEach(() => repor(app));
afterEach(() => { app.definirServicosDesligados([]); app.CW.cargos = {}; delete app._ultimoNaArea.analise; });

// os destinos (go('…')) de um pedaço de HTML, pela ordem
const destinos = (h) => [...h.matchAll(/data-click="go\('([^']+)'\)"/g)].map((m) => m[1]);
// os rótulos das abas, sem os números
const rotulos = (h) => [...h.matchAll(/<a [^>]*data-click="go\('[^']+'\)">([^<]+)/g)].map((m) => m[1].trim());
// a aba acesa: o destino dela
const acesa = (h) => { const m = /<a class="on" aria-current="page"[^>]*data-click="go\('([^']+)'\)"/.exec(h); return m && m[1]; };
// os dois vizinhos de onde se está: [anterior, seguinte]
const lados = () => [app.vizinhoNaArea(-1), app.vizinhoNaArea(1)];

/* Num separador, com a app limpa e só estes escondidos.
   Recebe: id — o separador; fora (opcional) — os ids escondidos.
   Devolve: nada. */
function em(id, fora) {
  limpar(app);
  app.tab = id;
  app.setPage = '';
  app.separadoresEscondidos = () => fora || [];
}

describe('a área da Análise', () => {
  test('é uma área com as três portas do grupo da gaveta, pela mesma ordem', () => {
    assert.ok(app.AREAS.analise, 'a Análise é uma área');
    assert.equal(app.AREAS.analise.label, 'Análise');
    assert.ok(['bars', 'trend'].includes(app.AREAS.analise.icon), 'o ícone é o de um dos separadores dela');
    igual(app.AREAS.analise.ids, ['reports', 'projections', 'fisco']);
    const grupo = app.NAV_GROUPS.find((g) => g.label === 'Análise');
    igual(app.AREAS.analise.ids, [...grupo.ids], 'as abas e a gaveta dizem o mesmo');
    for (const id of ['reports', 'projections', 'fisco']) assert.equal(app.areaDe(id), 'analise', id);
  });

  test('as abas no topo: Avaliação, Projeções e IRS · Anexo F, com a do separador acesa', () => {
    em('reports');
    const html = app.abasDaArea();
    assert.match(html, /^<div class="abas"><nav class="segm abas-area" aria-label="Análise">/);
    igual(destinos(html), ['reports', 'projections', 'fisco']);
    igual(rotulos(html), ['Avaliação', 'Projeções', 'IRS · Anexo F']);
    assert.equal(acesa(html), 'reports');
    assert.equal((html.match(/class="on"/g) || []).length, 1, 'uma só acesa');
    for (const id of ['projections', 'fisco']) {
      app.tab = id;
      assert.equal(acesa(app.abasDaArea()), id, id + ' acende a dele');
    }
  });

  test('com o IRS desligado ficam duas abas; com uma porta só à vista não há abas nem área', () => {
    em('reports', ['fisco']);
    const html = app.abasDaArea();
    igual(destinos(html), ['reports', 'projections']);
    assert.equal(app.areaComSeparadores(['fisco']), 'analise');
    em('fisco', ['reports', 'projections']);
    assert.equal(app.abasDaArea(), '', 'só o IRS à vista: o separador é o ecrã inteiro');
    assert.equal(app.areaComSeparadores(), '');
    assert.equal(app.tituloDoEcraHtml({ label: 'IRS · Anexo F' }), 'IRS · Anexo F');
    igual(lados(), ['', '']);
  });

  test('o serviço da Declaração desligado de verdade tira a aba do IRS', () => {
    limpar(app);
    app.tab = 'reports';
    app.CW.cargos = {};
    app.CW.user = { id: 'EU', name: 'Maria Costa', email: 'eu@exemplo.pt' };
    app.definirServicosDesligados(['fisco']);
    igual(destinos(app.abasDaArea()), ['reports', 'projections']);
    app.definirServicosDesligados([]);
    igual(destinos(app.abasDaArea()), ['reports', 'projections', 'fisco']);
  });

  test('o cabeçalho do telemóvel diz «Análise»; o do computador, o nome do separador', () => {
    em('projections');
    assert.equal(app.tituloDoEcraHtml({ label: 'Projeções' }), '<span class="tit-sep">Projeções</span><span class="tit-area">Análise</span>');
    app.tab = 'fisco';
    assert.equal(app.tituloDoEcraHtml({ label: 'IRS · Anexo F' }), '<span class="tit-sep">IRS · Anexo F</span><span class="tit-area">Análise</span>');
  });

  test('o carrossel percorre as três, sem dar a volta nas pontas, e fecha o buraco de uma escondida', () => {
    em('reports');
    igual(lados(), ['', 'projections']);
    app.tab = 'projections';
    igual(lados(), ['reports', 'fisco']);
    app.tab = 'fisco';
    igual(lados(), ['projections', '']);
    em('projections', ['fisco']);
    igual(lados(), ['reports', '']);
    em('fisco', ['projections']);
    igual(lados(), ['reports', '']);
  });

  test('a área lembra-se do separador onde se ficou', () => {
    em('dashboard');
    app.render = () => {};
    app.go('projections');
    assert.equal(app.destinoDe('analise', []), 'projections');
    assert.equal(app.destinoDe('analise', ['projections']), 'reports', 'escondido o lembrado, a primeira à vista');
  });

  test('a barra de baixo fica com os quatro destinos, e nada aceso na Análise', () => {
    igual(app.TABBAR, ['dashboard', 'casas', 'dinheiro', 'calendar']);
    em('fisco');
    app.buildNav();
    const barra = elementos(app).tabbar.innerHTML;
    assert.doesNotMatch(barra, /goBarra\('analise'\)/, 'a Análise não entra na barra');
    assert.doesNotMatch(barra, /<a class="on"/, 'na Análise nenhum destino da barra se acende');
  });
});

describe('as apresentações da Análise', () => {
  /* Uma conta com sessão, dona de tudo, com os serviços todos ligados.
     Devolve: nada. */
  function montar() {
    limpar(app);
    app.definirServicosDesligados([]);
    app.CW.user = { id: 'EU', name: 'Maria Costa', email: 'eu@exemplo.pt' };
    app.CW._pulled = 1; app.CW._esperaFim = 1;
    app.CW.cargos = {};
    app.CW.ambiente = 'percurso';
  }
  // as abas de uma maquete: [rótulos, acesa]
  const abas = (h) => {
    const m = /<div class="apr-m-abas">([\s\S]*?)<\/div>/.exec(h);
    if (!m) return null;
    const nomes = [...m[1].matchAll(/<span( class="on")?>([^<]+)<\/span>/g)];
    return [nomes.map((x) => x[2]), (nomes.find((x) => x[1]) || [])[2]];
  };
  const cabeca = (h) => (/<div class="apr-m-cab">[\s\S]*?<b>([^<]+)<\/b>/.exec(h) || [])[1];

  test('o ecrã de cada uma tem o título «Análise» e as três abas, com a dela acesa', () => {
    montar();
    for (const [id, aba] of [['reports', 'Avaliação'], ['projections', 'Projeções'], ['fisco', 'IRS · Anexo F']]) {
      const telas = app.aprImagensDe(id).map((im) => im.html).filter((h) => /apr-tela/.test(h));
      assert.ok(telas.length > 0, id + ': tem o ecrã do telemóvel');
      for (const h of telas) {
        assert.equal(cabeca(h), 'Análise', id + ': o cabeçalho diz a área, como no telemóvel');
        igual(abas(h), [['Avaliação', 'Projeções', 'IRS · Anexo F'], aba], id);
        assert.doesNotMatch(h, /apr-m-barra-i on/, id + ': a barra de baixo sem nada aceso');
      }
    }
  });

  test('com a Declaração desligada, as abas da Avaliação e das Projeções são duas', () => {
    montar();
    app.definirServicosDesligados(['fisco']);
    for (const [id, aba] of [['reports', 'Avaliação'], ['projections', 'Projeções']]) {
      const h = app.aprImagensDe(id).map((im) => im.html).find((x) => /apr-tela/.test(x));
      igual(abas(h), [['Avaliação', 'Projeções'], aba], id);
    }
  });
});
