// Os Colaboradores são o terceiro segmento das Pessoas (Inquilinos,
// Proprietários, Colaboradores), com quantos colaboram, e só com sessão na
// nuvem; acendem a porta das Pessoas e não a das Definições, e saíram das
// Definições: nem a linha «Colaboradores e cargos» na raiz, nem a navegação
// lateral delas, nem o Voltar. O ecrã é um ecrã da área Casas, com os
// separadores da área por cima, e desliza para os vizinhos como os outros;
// no computador o subtítulo diz quantas pessoas e quantos convites. Os textos
// que ensinam o caminho dizem «Pessoas → Colaboradores».

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { carregarApp, limpar, elementos, igual } from './arnes.js';

const le = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const css = le('web/estilos.css').replace(/\/\*[\s\S]*?\*\//g, '');

/* A app com a camada da nuvem dos colaboradores por cima (nucleo, partilha e
   colaboradores), sem rede: o pullNow e a api não saem daqui, e o estado é o
   que o teste diz.
   Recebe: o — {sessao (true por omissão), pulled (true por omissão), colaboradores (array)}.
   Devolve: o proxy da app. */
function montar(o = {}) {
  const app = carregarApp();
  app.document.documentElement.style.removeProperty = () => {};
  for (const nome of ['nucleo', 'partilha', 'colaboradores']) {
    vm.runInContext(le('web/cloud/' + nome + '.js'), app.__ctx, { filename: 'cloud/' + nome + '.js' });
  }
  app.api = () => Promise.resolve({});
  app.pullNow = () => Promise.resolve();
  app.toast = () => {};
  app.setSyncBadge = () => {};
  const db = limpar(app);
  db.tenants.push(app.normPerson({ id: 't1', name: 'Ana' }), app.normPerson({ id: 't2', name: 'Bruno' }), app.normPerson({ id: 't3', name: 'Carla' }));
  db.owners.push(Object.assign(app.normPerson({ id: 'o1', name: 'Rui' }), { _userId: 'o1' }));
  db.properties.push(app.normProp({ id: 'p1', name: 'T2 Porto', ownerIds: ['o1'] }));
  app.CW.user = o.sessao === false ? null : { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt', token: 't' };
  app.CW._pulled = o.pulled === false ? 0 : 1;
  app.CW.state = {
    me: { id: 'EU' }, roles: [{ id: 'R1', name: 'Gestor de visitas', perms: ['visit.view'], n: 1 }],
    collaborators: o.colaboradores || [
      { id: 'C1', userId: 'MARIA', name: 'Maria', roleId: 'R1', roleName: 'Gestor de visitas', houses: [{ id: 'p1', name: 'T2 Porto' }] },
    ],
    invites: [], connections: [],
  };
  return app;
}

// os destinos (go('…')) de um bocado de HTML, pela ordem
const destinos = (html) => [...html.matchAll(/go\('(\w+)'\)/g)].map((m) => m[1]);
// o segmentado das Pessoas, sozinho
const pessoas = (html) => (html.match(/<nav class="segm abas-pessoas"[\s\S]*?<\/nav>/) || [''])[0];

describe('a porta das Pessoas junta três', () => {
  test('PESSOAS são Inquilinos, Proprietários e Colaboradores, por esta ordem, e os Colaboradores são da área Casas', () => {
    const app = montar();
    igual(Array.from(app.PESSOAS), ['tenants', 'owners', 'colaboradores']);
    igual(Array.from(app.idsDaPorta('pessoas')), ['tenants', 'owners', 'colaboradores']);
    assert.equal(app.areaDe('colaboradores'), 'casas');
    app.tab = 'colaboradores';
    assert.equal(app.areaComSeparadores([]), 'casas', 'um ecrã de área, com os separadores por cima');
  });

  test('nos Colaboradores acende a porta das Pessoas e não a das Definições; os Grupos acendem a deles, nas Casas', () => {
    const app = montar();
    app.tab = 'colaboradores';
    assert.equal(app.portaAtiva('pessoas'), true);
    assert.equal(app.portaAtiva('settings'), false);
    app.tab = 'groups';
    assert.equal(app.portaAtiva('settings'), false, 'os Grupos já não vivem nas Definições');
    assert.equal(app.portaAtiva('groups'), true, 'são uma porta das Casas');
    assert.equal(app.areaDe('groups'), 'casas');
  });

  test('a porta leva aos Colaboradores quando é lá que se está, e a barra lateral marca-a acesa', () => {
    const app = montar();
    app.tab = 'colaboradores';
    assert.equal(app.destinoDe('pessoas', app.separadoresEscondidos()), 'colaboradores');
    app.buildNav();
    const nav = elementos(app).nav.innerHTML;
    assert.match(nav, /<a class="on" tabindex="0" aria-current="page" role="link" data-toca="ecra" data-click="go\('colaboradores'\)">[\s\S]*?<span class="txt">Pessoas<\/span>/);
    assert.doesNotMatch(nav, /<a class="on"[^>]*go\('settings'\)/);
  });
});

describe('o segmentado das Pessoas', () => {
  test('com sessão mostra os três, com quantos há de cada, e o aceso é o do ecrã', () => {
    const app = montar();
    app.tab = 'colaboradores';
    const html = app.abasDaArea();
    const seg = pessoas(html);
    igual(destinos(seg), ['tenants', 'owners', 'colaboradores']);
    assert.match(seg, />Inquilinos <span class="n">3<\/span><\/a>/);
    assert.match(seg, />Proprietários <span class="n">1<\/span><\/a>/);
    assert.match(seg, /<a class="on" aria-current="page" role="link" tabindex="0" data-toca="ecra" data-click="go\('colaboradores'\)">Colaboradores <span class="n">1<\/span><\/a>/);
    assert.match(html, /<nav class="segm abas-area" aria-label="Casas">[\s\S]*?<a class="on" aria-current="page"[^>]*go\('colaboradores'\)">Pessoas</, 'e a porta Pessoas acesa na área');
  });

  test('sem sessão na nuvem o terceiro some, e o segmentado fica com os dois de sempre', () => {
    const app = montar({ sessao: false });
    app.tab = 'tenants';
    igual(destinos(pessoas(app.abasDaArea())), ['tenants', 'owners']);
    assert.ok(app.separadoresEscondidos().indexOf('colaboradores') > -1);
  });

  test('conta pessoas e não linhas: quem tem dois cargos conta uma vez; os convites por usar não contam', () => {
    const app = montar({ colaboradores: [
      { id: 'C1', userId: 'MARIA', name: 'Maria', roleId: 'R1' },
      { id: 'C2', userId: 'MARIA', name: 'Maria', roleId: 'R2' },
      { id: 'C3', userId: 'JOAO', name: 'João', roleId: 'R1' },
    ] });
    app.CW.state.invites = [{ id: 'i1' }, { id: 'i2' }];
    assert.equal(app.contarColaboradores(), 2);
    assert.equal(app.contagemDePessoas('colaboradores'), 2);
    assert.equal(app.contagemDePessoas('tenants'), 3);
    app.CW.state.collaborators = [];
    assert.equal(app.contarColaboradores(), 0, 'depois de o servidor responder, o zero é verdade');
  });

  test('antes de o servidor responder não há número: o segmento diz só o nome', () => {
    const app = montar({ pulled: false });
    assert.equal(app.contarColaboradores(), null);
    app.tab = 'owners';
    const seg = pessoas(app.abasDaArea());
    assert.match(seg, /go\('colaboradores'\)">Colaboradores<\/a>/);
    assert.doesNotMatch(seg, /undefined|null/);
  });

  test('cabem três no telemóvel: o sublinhado encolhe o intervalo abaixo dos 420px, os alvos ficam com 44px e não há rolagem de lado', () => {
    assert.match(css, /\.segm\.abas-pessoas>a\{[^}]*min-height:44px/);
    const m = css.match(/@media\(max-width:420px\)\{([^{}]*\{[^{}]*\})*[^{}]*\}/g) || [];
    const regra = m.find((r) => r.includes('.abas-pessoas'));
    assert.ok(regra, 'há uma regra estreita para o segmentado das Pessoas');
    assert.match(regra, /\.segm\.abas-pessoas\{[^}]*gap:/);
    assert.doesNotMatch(css, /\.abas-pessoas\{[^}]*overflow-x:(auto|scroll)/, 'não rola de lado');
  });
});

describe('fora das Definições', () => {
  test('a raiz das Definições já não tem a linha «Colaboradores e cargos», nem a navegação lateral', () => {
    const app = montar();
    app.tab = 'settings';
    app.setPage = '';
    const raiz = app.vSettings();
    assert.ok(raiz.includes("goSet('cloud')"), 'controlo: a conta continua lá');
    assert.doesNotMatch(raiz, /Colaboradores e cargos|goSet\('colaboradores'\)/);
    assert.doesNotMatch(app.navDasDefinicoes(), /colaboradores/i);
    app.tab = 'colaboradores';
    assert.equal(app.paginaDasDefinicoes(), '', 'nada acende nas Definições a partir dos Colaboradores');
  });

  test('o ecrã dos Colaboradores não leva a cabeça das subpáginas, e o render põe-lhe os separadores da área', () => {
    const app = montar();
    assert.doesNotMatch(app.vColabTab(), /def-voltar|<nav class="def-nav"|go\('settings'\)/);
    const fixos = elementos(app);
    app.tab = 'colaboradores';
    app.render();
    const v = fixos.view.innerHTML;
    assert.match(v, /^<div class="abas"><nav class="segm abas-area" aria-label="Casas">/);
    assert.match(v, /abas-pessoas/);
    assert.match(v, /Convidar colaborador|Novo cargo/, 'e a página dos colaboradores logo a seguir');
    assert.match(fixos.pageTitle.innerHTML, /<span class="tit-sep">Colaboradores<\/span><span class="tit-area">Casas<\/span>/);
  });

  test('o subtítulo do ecrã (no computador) diz quantas pessoas colaboram e quantos convites esperam; antes do servidor, o que é', () => {
    const app = montar();
    app.CW.state.invites = [{ id: 'i1' }];
    app.tab = 'colaboradores';
    const meta = app.TABS.find((t) => t.id === 'colaboradores');
    assert.equal(app.subtituloDoEcra(meta), '1 pessoa · 1 convite por usar');
    app.CW._pulled = 0;
    assert.equal(app.subtituloDoEcra(meta), 'Quem ajuda a gerir, e com que cargo');
    app.tab = 'tenants';
    assert.equal(app.subtituloDoEcra(app.TABS.find((t) => t.id === 'tenants')), 'Ficha e documentos de cada pessoa', 'controlo: os outros ficam com o deles');
  });

  test('goSet(\'colaboradores\') — um atalho antigo — leva ao separador, fora das Definições', () => {
    const app = montar();
    app.render = () => {};
    app.tab = 'settings';
    app.goSet('colaboradores');
    assert.equal(app.tab, 'colaboradores');
    assert.equal(app.setPage, '');
  });

  test('a deslizar, os vizinhos dos Colaboradores são os da porta das Pessoas: os Contratos e as Visitas', () => {
    const app = montar();
    app.tab = 'colaboradores';
    assert.equal(app.vizinhoNaArea(-1, []), 'contracts');
    assert.equal(app.vizinhoNaArea(1, []), 'visits');
    assert.equal(app.portaVizinha(1, []), 'visits');
  });
});

describe('os textos ensinam o caminho novo', () => {
  test('a pergunta frequente e o aceitar do convite dizem «Pessoas → Colaboradores», e nenhum diz «Definições → Colaboradores»', () => {
    const app = montar();
    const faq = Array.from(app.PERGUNTAS_FREQUENTES).find((p) => p.id === 'colaborador');
    assert.match(faq.resposta, /em <b>Pessoas → Colaboradores<\/b>/);
    for (const f of ['web/cloud/colaboradores.js', 'web/cloud/partilha.js', 'web/app/navegacao.js', 'web/app/definicoes.js']) {
      assert.doesNotMatch(le(f), /Definições → Colaboradores/, f);
    }
    assert.match(le('web/cloud/colaboradores.js'), /Podes sair quando quiseres em Pessoas → Colaboradores\./);
    assert.doesNotMatch(le('web/cloud/colaboradores.js'), /linhaDefinicoes\(/, 'a porta das Definições saiu');
  });
});
