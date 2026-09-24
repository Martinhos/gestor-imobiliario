// A app em serviços: o catálogo, o registo, o despacho da base pelo registo,
// a autonomia de cada serviço (carrega e regista só com a base), e a lib do
// servidor com a migração. Um serviço é um separador da barra lateral; as
// Definições são a base.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

import { carregarApp, carregarServico, carregarBase, BASE, MODULOS, SERVICOS_FICHEIROS, igual, limpar, elementos } from './arnes.js';
import { baseDeTeste } from './lib/bd.js';
import * as srv from '../worker/src/lib/servicos.js';

const ler = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const existe = (rel) => existsSync(new URL('../' + rel, import.meta.url));
const SEM_SETTINGS = (app) => app.TABS.map((t) => t.id).filter((id) => id !== 'settings');

describe('o catálogo', () => {
  test('cada separador menos as Definições é um serviço, pela mesma ordem, e cada serviço é um separador', () => {
    const app = carregarApp();
    igual(JSON.parse(JSON.stringify(app.SERVICOS)).map((s) => s.id), JSON.parse(JSON.stringify(SEM_SETTINGS(app))));
    assert.equal(app.servicoDoSeparador('settings'), '', 'as Definições são a base');
    assert.equal(app.servicoDe('settings'), null);
    assert.equal(app.servicoDoSeparador('contracts'), 'contracts');
    assert.equal(app.nomeDoServico('fisco'), 'Declaração');
    assert.equal(app.nomeDoServico('xyz'), 'xyz');
  });

  test('os ficheiros de cada manifesto existem, estão no index.html, na SHELL do sw.js, no arnês e no MAPA', () => {
    const html = ler('web/index.html'), sw = ler('web/sw.js'), mapa = ler('scripts/gerar-docs.js');
    for (const s of SERVICOS_FICHEIROS) {
      assert.ok(s.ficheiros.length, s.id + ' tem ficheiros');
      for (const f of s.ficheiros) {
        assert.ok(existe('web/' + f), 'web/' + f + ' existe');
        assert.ok(html.includes('<script src="' + f + '"></script>'), f + ' no index.html');
        const base = f.replace(/^(app|cloud)\//, '').replace(/\.js$/, '');
        assert.match(sw, new RegExp("'" + base + "'"), f + ' na SHELL');
        if (f.startsWith('app/')) assert.ok(MODULOS.includes(base), f + ' em MODULOS');
        assert.ok(mapa.includes("'web/" + f + "'"), f + ' no MAPA');
      }
    }
  });

  test('cada serviço regista-se no fim do seu ficheiro principal', () => {
    for (const s of SERVICOS_FICHEIROS) {
      const src = ler('web/' + s.ficheiros[0]);
      assert.match(src, new RegExp("registarServico\\(\\{\\s*id:\\s*'" + s.id + "'"), s.id + ' regista-se em ' + s.ficheiros[0]);
    }
  });

  test('requer e usa só apontam para serviços do catálogo, nunca para o próprio', () => {
    const ids = new Set(SERVICOS_FICHEIROS.map((s) => s.id));
    for (const s of SERVICOS_FICHEIROS) {
      for (const r of s.requer.concat(s.usa)) {
        assert.ok(ids.has(r), s.id + ' aponta para ' + r);
        assert.notEqual(r, s.id, s.id + ' aponta para si próprio');
      }
    }
  });

  test('a base não é vazia e não contém ficheiros de serviço', () => {
    assert.ok(BASE.includes('vistas') && BASE.includes('servicos') && BASE.includes('definicoes'));
    for (const s of SERVICOS_FICHEIROS) for (const f of s.ficheiros) assert.ok(!BASE.includes(f.slice(4, -3)), f + ' não é da base');
  });

  test('a base não nomeia serviços: os mapas de vistas por separador saíram de vistas.js', () => {
    const src = ler('web/app/vistas.js');
    assert.ok(!src.includes('dashboard:vDashboard'), 'o render despacha pelo registo');
    assert.ok(!src.includes("tab==='transactions'"), 'o botão de filtros não conhece os movimentos');
    assert.ok(!src.includes('pintarListaTx()') && !src.includes('pintarRendasDosGrupos()'), 'o «depois» vem do registo');
    const nav = ler('web/app/navegacao.js');
    assert.ok(!nav.includes('recActive'), 'o crachá vem do registo');
    const comp = ler('web/app/componentes.js');
    assert.ok(!comp.includes("k==='prop'"), 'o lpMenu despacha pelo registo');
  });
});

describe('ligado e desligado', () => {
  test('sem conta está tudo ligado', () => {
    const app = carregarApp();
    for (const s of SERVICOS_FICHEIROS) assert.ok(app.servicoLigado(s.id), s.id);
    igual(app.servicosDesligados(), []);
    assert.ok(app.separadorLigado('settings'));
    assert.ok(app.servicoLigado('xyz'), 'o que não é serviço está sempre ligado');
  });

  test('desligar aplica o fecho dos que requerem, na ordem do catálogo, e fica no aparelho', () => {
    const app = carregarApp();
    app.definirServicosDesligados(['properties']);
    igual(app.servicosDesligados(), ['properties', 'contracts', 'visits', 'colaboradores', 'credits']);
    assert.ok(!app.servicoLigado('contracts'));
    assert.ok(app.servicoLigado('transactions'));
    assert.ok(!app.separadorLigado('credits'));
    assert.ok(app.separadorLigado('settings'), 'as Definições nunca se desligam');
    igual(JSON.parse(app.localStorage.getItem('gi_servicos_off')), ['properties', 'contracts', 'visits', 'colaboradores', 'credits']);
    app.definirServicosDesligados(['transactions']);
    igual(app.servicosDesligados(), ['transactions', 'recurring']);
    app.definirServicosDesligados([]);
    igual(app.servicosDesligados(), []);
  });

  test('ids fora do catálogo caem, e a lista devolvida é uma cópia', () => {
    const app = carregarApp();
    app.definirServicosDesligados(['xyz', 'fisco']);
    const l = app.servicosDesligados();
    igual(l, ['fisco']);
    l.push('dashboard');
    igual(app.servicosDesligados(), ['fisco']);
  });

  test('fechoDesligados é a mesma regra no cliente e no servidor', () => {
    const app = carregarApp();
    for (const entrada of [['properties'], ['transactions'], ['tenants'], ['recurring', 'calendar'], [], ['xyz']]) {
      igual(app.fechoDesligados(entrada), srv.fechoDesligados(entrada), JSON.stringify(entrada));
    }
  });

  test('kindDesligado sabe de quem é cada kind', () => {
    const app = carregarApp();
    app.definirServicosDesligados(['contracts', 'recurring']);
    assert.ok(app.kindDesligado('contract'));
    assert.ok(app.kindDesligado('rec'));
    assert.ok(app.kindDesligado('tpl', 'user'));
    assert.ok(!app.kindDesligado('tx'));
    assert.ok(!app.kindDesligado('settings', 'user'), 'as definições são da base');
  });

  test('os separadores escondidos incluem os serviços desligados, sem repetir', () => {
    const app = carregarApp();
    app.definirServicosDesligados(['properties']);
    const fora = JSON.parse(JSON.stringify(app.separadoresEscondidos()));
    for (const id of ['properties', 'contracts', 'visits', 'colaboradores', 'credits']) assert.ok(fora.includes(id), id);
    assert.equal(fora.filter((x) => x === 'colaboradores').length, 1, 'colaboradores uma vez só');
  });
});

describe('o despacho pelo registo', () => {
  test('com tudo carregado, cada separador tem vista — as Definições incluídas', () => {
    const app = carregarApp();
    for (const t of app.TABS) assert.equal(typeof app.vistaDoSeparador(t.id), 'function', t.id);
  });

  test('um serviço desligado não tem vista, e o render pinta o ecrã que explica', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    app.definirServicosDesligados(['contracts']);
    assert.equal(app.vistaDoSeparador('contracts'), null);
    app.tab = 'contracts';
    app.render();
    const html = fixos.view.innerHTML;
    assert.match(html, /Contratos está desligado nesta conta/);
    assert.match(html, /suporte/);
    assert.match(html, /go\(primeiroSeparadorLigado\(\)\)/);
    assert.ok(!/Ver mais|Novo contrato/.test(html));
    // e um separador ligado continua a pintar a sua vista
    app.tab = 'dashboard';
    app.render();
    assert.ok(!/está desligado nesta conta/.test(fixos.view.innerHTML));
  });

  test('buildNav esconde o separador desligado e mantém os outros', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    app.buildNav();
    assert.ok(fixos.nav.innerHTML.includes("go('contracts')"), 'controlo positivo: ligado aparece');
    app.definirServicosDesligados(['contracts']);
    app.buildNav();
    assert.ok(!fixos.nav.innerHTML.includes("go('contracts')"));
    assert.ok(fixos.nav.innerHTML.includes("go('dashboard')"));
    assert.ok(fixos.nav.innerHTML.includes("go('settings')"));
    app.definirServicosDesligados(['properties']);
    app.buildNav();
    assert.ok(!fixos.tabbar.innerHTML.includes("goBarra('properties')"), 'a barra de baixo também');
    assert.ok(fixos.tabbar.innerHTML.includes("goBarra('dashboard')"));
  });

  test('go recusa um separador desligado e fica onde está', () => {
    const app = carregarApp();
    elementos(app);
    app.definirServicosDesligados(['fisco']);
    app.go('fisco');
    assert.equal(app.tab, 'dashboard');
    app.go('reports');
    assert.equal(app.tab, 'reports');
  });

  test('primeiroSeparadorLigado segue a ordem do menu e cai nas Definições no limite', () => {
    const app = carregarApp();
    assert.equal(app.primeiroSeparadorLigado(), 'dashboard');
    app.definirServicosDesligados(['dashboard']);
    assert.equal(app.primeiroSeparadorLigado(), 'properties');
    app.definirServicosDesligados(SERVICOS_FICHEIROS.map((s) => s.id));
    assert.equal(app.primeiroSeparadorLigado(), 'settings');
  });

  test('restorePage não restaura um separador desligado', () => {
    const app = carregarApp();
    // a nuvem só se carrega inteira; aqui basta o que restorePage precisa
    vm.runInContext(ler('web/cloud/nucleo.js').split('\n').filter((l) => !/^'use strict'/.test(l)).join('\n')
      .replace(/^[\s\S]*?(var LS_PAGE = 'gi_page';)/, '$1').replace(/\/\/ A guarda de «só o dono apaga o imóvel»[\s\S]*$/, ''), app.__ctx);
    app.localStorage.setItem('gi_page', JSON.stringify({ tab: 'fisco', set: '' }));
    app.restorePage();
    assert.equal(app.tab, 'fisco', 'controlo positivo: ligado restaura');
    app.tab = 'dashboard';
    app.definirServicosDesligados(['fisco']);
    app.restorePage();
    assert.equal(app.tab, 'dashboard');
  });

  test('o toque longo despacha pelo prefixo registado, e não abre nada com o serviço desligado', () => {
    const app = carregarApp();
    let visto = null;
    app.lpImovel = (a) => { visto = JSON.parse(JSON.stringify(a)); };
    app.lpMenu('prop:abc');
    igual(visto, ['prop', 'abc']);
    visto = null;
    app.definirServicosDesligados(['properties']);
    app.lpMenu('prop:abc');
    assert.equal(visto, null);
    assert.equal(app.lpDe('prop'), null);
    assert.equal(app.lpMenu('nada:1'), undefined, 'um prefixo sem dono não rebenta');
  });

  test('as pessoas registam o mesmo handler pelos dois serviços: com um deles ligado ainda há menu', () => {
    const app = carregarApp();
    assert.equal(typeof app.lpDe('per'), 'function');
    app.definirServicosDesligados(['tenants']);
    assert.equal(typeof app.lpDe('per'), 'function', 'os proprietários ainda o têm');
    app.definirServicosDesligados(['tenants', 'owners']);
    assert.equal(app.lpDe('per'), null);
  });

  test('lpExtras: outro serviço acrescenta opções ao menu de um imóvel, e some quando está desligado', () => {
    const app = carregarApp();
    vm.runInContext("function extraDeTeste(a){return [{label:'Opção de teste '+a[1],icon:'pen',act:function(){}}]}", app.__ctx);
    app.registarServico({ id: 'credits', lpExtras: { prop: 'extraDeTeste' } });
    const itens = JSON.parse(JSON.stringify(app.lpExtrasDe('prop', ['prop', 'x'])));
    assert.equal(itens.length, 1);
    assert.equal(itens[0].label, 'Opção de teste x');
    app.definirServicosDesligados(['credits']);
    igual(app.lpExtrasDe('prop', ['prop', 'x']), []);
  });

  test('registar um serviço fora do catálogo rebenta; registar duas vezes junta', () => {
    const app = carregarApp();
    assert.throws(() => app.registarServico({ id: 'xyz', vistas: {} }), /desconhecido/);
    app.registarServico({ id: 'fisco', depois: { fisco: 'vFisco' } });
    assert.equal(typeof app.depoisDoSeparador('fisco'), 'function');
    assert.equal(typeof app.vistaDoSeparador('fisco'), 'function', 'a vista registada antes ficou');
  });

  test('depois, análise e crachá: o que cada serviço registou, só com ele ligado', () => {
    const app = carregarApp();
    assert.equal(app.depoisDoSeparador('contracts'), app.pintarRendasDosGrupos);
    assert.equal(app.depoisDoSeparador('transactions'), app.pintarListaTx);
    assert.equal(app.depoisDoSeparador('properties'), app.propsDepois);
    assert.equal(app.depoisDoSeparador('dashboard'), app.dashDepois);
    assert.equal(app.depoisDoSeparador('fisco'), null);
    const ana = app.analiseDe('dashboard');
    assert.equal(ana.n(), 0);
    app.ownerFilter = 'o1';
    assert.equal(ana.n(), 1);
    app.dashProp = 'p1';
    assert.equal(app.analiseDe('dashboard').n(), 2);
    app.analiseDe('dashboard').limpar();
    assert.equal(app.dashProp, '');
    assert.equal(app.analiseDe('fisco').n(), 1, 'a Declaração conta só o proprietário');
    assert.equal(typeof app.analiseDe('transactions').alternar, 'function', 'os movimentos têm painel próprio');
    assert.equal(typeof app.analiseDe('transactions').limpar, 'function', 'e limpam os seus filtros pelo botão dos estados vazios');
    app.txSearch = 'x'; app.txFilter = 'income';
    app.analiseDe('transactions').limpar();
    assert.equal(app.txSearch, ''); assert.equal(app.txFilter, '');
    assert.equal(app.analiseDe('properties'), null, 'as listas de registos não são análise');
    igual(app.crachaDe('recurring'), { n: 0, aviso: true });
    igual(app.crachaDe('calendar'), { n: 0, so: 'barra' });
    assert.equal(app.crachaDe('fisco'), null);
    app.definirServicosDesligados(['dashboard', 'recurring']);
    assert.equal(app.analiseDe('dashboard'), null);
    assert.equal(app.depoisDoSeparador('dashboard'), null);
    assert.equal(app.crachaDe('recurring'), null);
    igual(app.crachaDe('calendar'), { n: 0, so: 'barra' }, 'o calendário fica, sem os planeados');
  });

  test('hdrFiltN e o botão de filtros passam pelo registo: os movimentos contam os seus filtros', () => {
    const app = carregarApp();
    app.tab = 'transactions';
    assert.equal(app.hdrFiltN(), 0);
    app.txSearch = 'renda';
    assert.equal(app.hdrFiltN(), 1);
    app.tab = 'properties';
    assert.equal(app.hdrFiltN(), 0, 'as listas contam pelo lf');
  });

  test('chamarServico corre só com o serviço ligado, e hintServicoDesligado diz o nome', () => {
    const app = carregarApp();
    vm.runInContext('function somaDeTeste(a,b){return a+b}', app.__ctx);
    assert.equal(app.chamarServico('credits', 'somaDeTeste', 2, 3), 5);
    app.definirServicosDesligados(['credits']);
    assert.equal(app.chamarServico('credits', 'somaDeTeste', 2, 3), undefined);
    assert.equal(app.hintServicoDesligado('credits'), 'O serviço Créditos está desligado nesta conta.');
    assert.equal(app.hintServicoDesligado('credits'), srv.FRASE_DESLIGADO('credits'), 'a mesma frase que o servidor');
  });

  /* A fuga da segunda revisão: o chamarServico chama-se de uma ação, e o
     nome ia direto ao window — chamarServico('x','fetch','/x') fazia o pedido. */
  test('chamarServico só chega a funções da app: um nome do browser rebenta, e não corre', () => {
    let correu = 0;
    const nativa = () => Function.prototype.bind.call(() => { correu++; }, null);
    const app = carregarApp({ antes: (ctx) => { ctx.alert = nativa(); ctx.fetch = nativa(); } });
    for (const n of ['fetch', 'alert', 'setTimeout', 'localStorage']) {
      assert.throws(() => app.chamarServico('x', n, '/x'), /ação: recusado: «\w+» é do browser, e não da app/, n);
      assert.equal(app.funcaoDeTopo(n), null, n);
    }
    assert.equal(correu, 0);
    vm.runInContext('function somaDeTeste(a,b){return a+b}', app.__ctx);
    assert.equal(app.chamarServico('x', 'somaDeTeste', 2, 3), 5, 'uma função da app pelo nome continua a correr');
  });

  test('aoMudarDeSeparador arruma o donut da visão geral', () => {
    const app = carregarApp();
    app.donutCat = 'x';
    app.aoMudarDeSeparador();
    assert.equal(app.donutCat, '');
  });
});

describe('autonomia: cada serviço carrega e regista-se só com a base', () => {
  for (const s of SERVICOS_FICHEIROS) {
    test('autonomia: ' + s.id + ' carrega com a base e o que requer, e os outros ficam desligados', () => {
      const app = carregarServico([s.id]);
      assert.equal(typeof app.vistaDoSeparador(s.id), 'function', 'a vista está registada');
      assert.ok(app.servicoLigado(s.id));
      for (const r of s.requer) assert.ok(app.servicoLigado(r), r + ' (requerido) está ligado');
      const fecho = new Set([s.id].concat(srv.fechoDesligados([])));
      const ligados = SERVICOS_FICHEIROS.map((x) => x.id).filter((id) => app.servicoLigado(id));
      for (const id of ligados) assert.ok(id === s.id || (function requerTransitivo(a) { return s.requer.includes(a) || s.requer.some((r) => SERVICOS_FICHEIROS.find((x) => x.id === r).requer.includes(a)); })(id), id + ' não devia estar ligado');
      assert.ok(fecho.size >= 1);
      assert.ok(app.separadorLigado('settings'));
      assert.equal(typeof app.vistaDoSeparador('settings'), 'function', 'as Definições rendem sempre');
    });
  }

  test('autonomia: a base sozinha carrega, as Definições têm vista e nenhum serviço', () => {
    const app = carregarBase();
    assert.equal(typeof app.vistaDoSeparador('settings'), 'function');
    for (const s of SERVICOS_FICHEIROS) {
      assert.equal(app.vistaDoSeparador(s.id), null, s.id);
      assert.ok(!app.servicoLigado(s.id), s.id + ' desligado');
    }
    const fixos = elementos(app);
    app.buildNav();
    assert.ok(fixos.nav.innerHTML.includes("go('settings')"));
    for (const s of SERVICOS_FICHEIROS) assert.ok(!fixos.nav.innerHTML.includes("go('" + s.id + "')"), s.id + ' fora do menu');
    app.tab = 'settings';
    app.render();
    assert.ok(fixos.view.innerHTML.length > 0);
  });
});

describe('servidor: a lib e a migração', () => {
  const env = () => ({ DB: baseDeTeste() });

  test('servidor: a migração 0015 cria user_services no duplo da D1', async () => {
    const e = env();
    const t = await e.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_services'").first();
    assert.ok(t, 'a tabela existe');
    igual(await srv.servicosDesligados(e, 'U1'), []);
  });

  test('servidor: os dois catálogos batem certo, campo a campo', () => {
    const cliente = SERVICOS_FICHEIROS.map((s) => ({ id: s.id, nome: s.nome, requer: s.requer, kinds: s.kinds, userKinds: s.userKinds, casa: s.casa, colab: s.colab }));
    igual(cliente, srv.SERVICOS);
  });

  test('servidor: desligar grava o fecho com quem mexeu; ligar exige os requer ligados', async () => {
    const e = env();
    const depois = await srv.guardarServico(e, 'U1', 'properties', false, 's1');
    igual(depois, ['properties', 'contracts', 'visits', 'colaboradores', 'credits']);
    igual(await srv.servicosDesligados(e, 'U1'), depois);
    const linhas = (await e.DB.prepare('SELECT service, enabled, updated_by FROM user_services WHERE user_id = ? ORDER BY service').bind('U1').all()).results;
    assert.equal(linhas.length, 5);
    for (const l of linhas) { assert.equal(l.enabled, 0); assert.equal(l.updated_by, 's1'); }
    igual(await srv.servicosDesligados(e, 'U2'), [], 'outra conta não é tocada');
    await assert.rejects(() => srv.guardarServico(e, 'U1', 'contracts', true, 's1'), (err) => err.status === 400 && /Imóveis/.test(err.error));
    igual(await srv.guardarServico(e, 'U1', 'properties', true, 's2'), ['contracts', 'visits', 'colaboradores', 'credits'], 'os dependentes ficam desligados de propósito');
    igual(await srv.guardarServico(e, 'U1', 'contracts', true, 's2'), ['visits', 'colaboradores', 'credits']);
    const p = await e.DB.prepare('SELECT enabled, updated_by FROM user_services WHERE user_id = ? AND service = ?').bind('U1', 'properties').first();
    assert.equal(p.enabled, 1);
    assert.equal(p.updated_by, 's2');
  });

  test('servidor: um serviço fora do catálogo é 400', async () => {
    await assert.rejects(() => srv.guardarServico(env(), 'U1', 'xyz', false, 's1'), (err) => err.status === 400);
  });

  test('servidor: uma linha antiga sem os dependentes ainda dá o fecho ao ler', async () => {
    const e = env();
    await e.DB.prepare('INSERT INTO user_services (user_id, service, enabled, updated_at, updated_by) VALUES (?, ?, 0, ?, ?)').bind('U1', 'transactions', 1, '').run();
    igual(await srv.servicosDesligados(e, 'U1'), ['transactions', 'recurring']);
  });

  test('servidor: as perguntas das rotas — kinds, casas, colaboradores, dono de um kind, frase', () => {
    igual([...srv.kindsDesligados(['contracts', 'transactions'])], ['contract', 'tx', 'rec'], 'sem movimentos caem os planeados');
    igual([...srv.kindsDesligados(['properties'])], ['contract', 'visit'], 'o fecho aplica-se');
    igual([...srv.userKindsDesligados(['recurring'])], ['rec', 'tpl']);
    igual([...srv.userKindsDesligados(['transactions'])], ['tx', 'rec', 'tpl']);
    assert.ok(srv.casaDesligada(['properties']));
    assert.ok(!srv.casaDesligada(['contracts']));
    assert.ok(srv.colabDesligado(['properties']), 'sem imóveis não há colaboradores');
    assert.ok(!srv.colabDesligado(['fisco']));
    assert.equal(srv.servicoDoKind('tx'), 'transactions');
    assert.equal(srv.servicoDoKind('tpl', 'user'), 'recurring');
    assert.equal(srv.servicoDoKind('tpl'), '', 'tpl não é kind de records');
    assert.equal(srv.servicoDoKind('settings', 'user'), '', 'as definições são da base');
    assert.equal(srv.FRASE_DESLIGADO('contracts'), 'O serviço Contratos está desligado nesta conta.');
  });
});

describe('integração: os menus de toque longo juntam o que cada serviço contribui, sem repetir', () => {
  /* um imóvel de investimento com contrato ativo e hipoteca viva, para o
     menu ter tudo o que os vizinhos contribuem */
  function semear(app) {
    const db = limpar(app);
    db.owners.push({ id: 'o1', name: 'Ana' });
    db.tenants.push({ id: 't1', name: 'Rui' });
    db.properties.push({ id: 'p1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['o1'], loans: [{ id: 'l1', outstanding: 1000, rate: 3, term: 120 }] });
    db.contracts.push({ id: 'c1', propertyId: 'p1', tenantIds: ['t1'], rent: 800, start: '2024-01-01', active: true });
    return db;
  }
  function labelsDe(app, chamar) {
    let visto = null;
    app.lpShow = (t, opts) => { visto = JSON.parse(JSON.stringify(opts.map((o) => o.label))); };
    chamar();
    return visto || [];
  }
  const repetidos = (l) => l.filter((x, i) => l.indexOf(x) !== i);

  test('integração: o menu de um imóvel traz o dos Contratos, dos Movimentos e dos Créditos uma vez cada', () => {
    const app = carregarApp();
    semear(app);
    const labels = labelsDe(app, () => app.lpImovel(['prop', 'p1']));
    igual(repetidos(labels), [], 'sem repetições: ' + labels.join(' | '));
    for (const l of ['Editar imóvel', 'Novo contrato', 'Registar despesa', 'Pagamento de crédito', 'Amortização', 'Apagar imóvel']) assert.ok(labels.includes(l), l + ' em ' + labels.join(' | '));
    app.definirServicosDesligados(['contracts', 'transactions']);
    const menos = labelsDe(app, () => app.lpImovel(['prop', 'p1']));
    for (const l of ['Novo contrato', 'Registar despesa', 'Pagamento de crédito']) assert.ok(!menos.includes(l), l + ' saiu');
    assert.ok(menos.includes('Editar imóvel'));
  });

  test('integração: o menu de um contrato traz «Registar renda» dos Movimentos uma vez', () => {
    const app = carregarApp();
    semear(app);
    const labels = labelsDe(app, () => app.lpContrato(['ct', 'c1']));
    igual(repetidos(labels), []);
    assert.equal(labels.filter((l) => l === 'Registar renda').length, 1, labels.join(' | '));
    app.definirServicosDesligados(['transactions']);
    assert.ok(!labelsDe(app, () => app.lpContrato(['ct', 'c1'])).includes('Registar renda'));
  });

  test('integração: o menu de um inquilino traz «Novo contrato» dos Contratos uma vez, e some sem eles', () => {
    const app = carregarApp();
    semear(app);
    const labels = labelsDe(app, () => app.lpPessoa(['per', 'tenant', 't1']));
    igual(repetidos(labels), []);
    assert.equal(labels.filter((l) => l === 'Novo contrato').length, 1, labels.join(' | '));
    app.definirServicosDesligados(['contracts']);
    assert.ok(!labelsDe(app, () => app.lpPessoa(['per', 'tenant', 't1'])).includes('Novo contrato'));
  });

  /* A base não depende de serviço nenhum: nenhum ficheiro do index.html fora
     dos manifestos chama um nome de topo de um serviço sem `servicoLigado`,
     `chamarServico` ou `typeof` na mesma linha. É a regra que deixa um
     serviço desligado — ou nem carregado, no arnês — sem partir a base. */
  test('integração: a base não chama serviço nenhum sem guarda', () => {
    const html = ler('web/index.html');
    const todos = (html.match(/src="([^"]+\.js)"/g) || []).map((s) => s.slice(5, -1));
    const deServico = new Set(SERVICOS_FICHEIROS.flatMap((s) => s.ficheiros));
    const declaracoes = (rel) => {
      const src = ler(rel).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^[ \t]*\/\/.*$/gm, '');
      return src.split('\n').map((l) => (/^(?:var|let|const|function|class|async function)\s+([A-Za-z_$][\w$]*)/.exec(l) || [])[1]).filter(Boolean);
    };
    const dono = new Map();
    for (const s of SERVICOS_FICHEIROS) for (const f of s.ficheiros) for (const n of declaracoes('web/' + f)) dono.set(n, (dono.get(n) || '') + s.id + ' ');
    const falhas = [];
    for (const f of todos) {
      if (deServico.has(f) || f === 'avisos.js' || f === 'legal.js') continue;
      const src = ler('web/' + f).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^[ \t]*\/\/.*$/gm, '');
      src.split('\n').forEach((l, i) => {
        const codigo = l.replace(/`[^`]*`|'[^']*'|"[^"]*"/g, '""');
        const re = /(^|[^\w$.'"])([A-Za-z_$][\w$]*)\s*\(/g;
        let m;
        while ((m = re.exec(codigo))) {
          if (!dono.has(m[2])) continue;
          if (/servicoLigado\(|chamarServico\(|typeof /.test(l)) continue;
          falhas.push(f + ':' + (i + 1) + ' chama «' + m[2] + '» de ' + dono.get(m[2]).trim());
        }
      });
    }
    assert.deepEqual(falhas, [], 'a base chama um serviço sem guarda');
    assert.ok(dono.size > 100, 'leu ' + dono.size + ' nomes de serviço — a leitura deixou de reconhecer as declarações?');
  });
});
