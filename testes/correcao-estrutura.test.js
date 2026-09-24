// A estrutura do cliente (vaga 2 das correções da avaliação de 2026-09-14): o
// antigo auxiliares.js partido por domínio, os módulos da base declarados pelo
// nome, a derivação do capital em dívida ligada à montagem da base, uma forma
// só de abrir o formulário do movimento, os vazios e o painel de análise
// partilhados, uma raiz só nas Definições, a pasta cloud/ explicada, e o
// comentário Recebe/Devolve em cada `const x = y =>`. Cada teste diz a regra;
// o achado que a encontrou por cumprir vai num comentário por cima dele.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { carregarApp, carregarTudo, carregarBase, MODULOS, BASE, SERVICOS_FICHEIROS, limpar } from './arnes.js';

const RAIZ = new URL('../', import.meta.url);
const ler = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8').replace(/\r\n/g, '\n');
const existe = (rel) => existsSync(new URL(rel, RAIZ));
const copia = (x) => JSON.parse(JSON.stringify(x));
/* os domínios que saíram do antigo auxiliares.js, pela ordem do index.html */
const DOMINIOS = ['formato', 'espera', 'registos', 'tipos', 'irs', 'saldos', 'ambito', 'icones', 'tema'];

/* Os .js de uma pasta de web/, com o caminho relativo à raiz.
   Recebe: pasta — 'web/app' ou 'web/cloud' (ou 'web', que junta as duas e os da raiz).
   Devolve: array de caminhos. */
function jsDe(pasta) {
  const out = [];
  const varre = (d) => {
    for (const n of readdirSync(new URL(d + '/', RAIZ), { withFileTypes: true })) {
      if (n.isDirectory()) varre(d + '/' + n.name);
      else if (n.name.endsWith('.js')) out.push(d + '/' + n.name);
    }
  };
  varre(pasta);
  return out;
}
/* O texto de um ficheiro sem os comentários (as linhas ficam no sítio).
   Recebe: rel — o caminho. Devolve: o texto. */
const semComentarios = (rel) => ler(rel).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^[ \t]*\/\/.*$/gm, '');

/* A janela que o openModal abriria, guardada em vez de pintada.
   Recebe: app. Devolve: o array onde cada abertura deixa {t, b}. */
function janelas(app) {
  const abertas = [];
  app.openModal = (t, b) => { abertas.push({ t, b }); };
  app.closeModal = () => {};
  app.closeAllModals = () => {};
  return abertas;
}

describe('o antigo auxiliares.js, partido por domínio', () => {
  // achado A.1-5
  test('cada domínio tem o seu ficheiro, onde o auxiliares.js estava, no index.html, na SHELL, no arnês e no MAPA', () => {
    assert.ok(!existe('web/app/auxiliares.js'), 'o ficheiro de «auxiliares» saiu');
    const html = ler('web/index.html'), sw = ler('web/sw.js'), mapa = ler('scripts/gerar-docs.js');
    const srcs = (html.match(/src="([^"]+\.js)"/g) || []).map((s) => s.slice(5, -1));
    const i = srcs.indexOf('app/anexos.js');
    assert.deepEqual(srcs.slice(i + 1, i + 1 + DOMINIOS.length), DOMINIOS.map((n) => 'app/' + n + '.js'),
      'logo a seguir ao anexos.js, como o auxiliares.js: o que se chama ao carregar já existe');
    assert.equal(srcs[i + 1 + DOMINIOS.length], 'app/lista.js');
    for (const n of DOMINIOS) {
      assert.ok(MODULOS.includes(n) && BASE.includes(n), n + ' no arnês, na base');
      assert.match(sw, new RegExp("'" + n + "'"), n + ' na SHELL');
      assert.ok(mapa.includes("'web/app/" + n + ".js'"), n + ' no MAPA');
      assert.match(ler('web/app/' + n + '.js'), /^\/\* =+ [^\n]+=+\n {3}\S/, n + '.js abre com o cabeçalho do domínio');
    }
  });

  // achado A.1-5
  test('as funções mudaram de ficheiro sem mudar de natureza: a nuvem embrulha-as e o registo resolve-as pelo nome', () => {
    const app = carregarTudo();
    for (const n of ['setTheme', 'applyTheme', 'balancesDetail', 'ownerBalances', 'toast', 'esperaDoServidor', 'haSessao', 'nomeDoTipo', 'ic']) {
      assert.equal(typeof app.window[n], 'function', n + ' continua function de topo (vista pelo window)');
    }
    assert.notEqual(app._setTheme, app.setTheme, 'a nuvem ainda embrulha o setTheme');
    assert.match(ler('web/app/componentes.js'), /^function toast\(m,op\)/m, 'o aviso vive com os outros componentes');
    assert.match(ler('web/app/saldos.js'), /^function balancesDetail\(pid\)/m, 'a janela dos saldos vive com as contas');
    assert.match(ler('web/app/ambito.js'), /^let ownerFilter='',dashProp='';/m, 'o estado do filtro vive à parte das funções puras');
    assert.match(ler('web/app/irs.js'), /^function irsColunaDe\(t\)/m);
    assert.equal(app.euro2(1250.5), '1 250,50 €');
    assert.equal(app.dPT('2028-03-15'), '15/03/2028');
  });
});

describe('o comentário de interface em todas as formas', () => {
  // achado A.1-11b
  test('cada `const x = y =>` de topo em web/ tem por cima o comentário com Recebe e Devolve', () => {
    const FORMA = /^(?:export )?const (\w+)\s*=\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*=>/;
    const nuas = [];
    let vistas = 0;
    for (const f of jsDe('web')) {
      const L = ler(f).split('\n');
      L.forEach((l, i) => {
        const m = FORMA.exec(l);
        if (!m) return;
        vistas++;
        let doc = '';
        if (i > 0 && L[i - 1].trim().endsWith('*/')) {
          for (let j = i - 1; j >= 0 && j > i - 40; j--) if (/^\s*\/\*/.test(L[j])) { doc = L.slice(j, i).join('\n'); break; }
        } else {
          for (let j = i - 1; j >= 0 && L[j].trim().startsWith('//'); j--) doc = L[j] + '\n' + doc;
        }
        if (!/Recebe:/.test(doc) || !/Devolve:/.test(doc)) nuas.push(f + ':' + (i + 1) + ' ' + m[1]);
      });
    }
    assert.deepEqual(nuas, []);
    assert.ok(vistas > 60, 'viu ' + vistas + ' — a expressão deixou de reconhecer a forma?');
  });
});

describe('os módulos da base, pelo nome', () => {
  // achado A.2-12b
  test('a base diz-se pelo nome no arnês e no sw.js, prazos e notificacoes incluídos, e as listas batem com o index.html e o catálogo', () => {
    const arnes = ler('testes/arnes.js');
    assert.doesNotMatch(arnes, /BASE = MODULOS\.filter/, 'a base não é «o que sobra» dos serviços');
    const decl = (arnes.match(/export const BASE = \[([\s\S]*?)\]/) || [])[1] || '';
    for (const n of ['prazos', 'notificacoes', 'splitwise', 'credito']) assert.match(decl, new RegExp("'" + n + "'"), n + ' declarado na base do arnês');
    const nomes = (s) => (s.match(/'([^']+)'/g) || []).map((x) => x.slice(1, -1));
    const app = (ler('web/sw.js').match(/const APP = \[([\s\S]*?)\]/) || [])[1] || '';
    const [base, servicos] = app.split('// os serviços');
    assert.ok(servicos, 'a lista do sw.js tem os dois grupos');
    assert.deepEqual(nomes(base), BASE.concat(['arranque']), 'a base do sw.js é a do arnês, mais o arranque');
    const doCatalogo = [...new Set(SERVICOS_FICHEIROS.flatMap((s) => s.ficheiros).filter((f) => f.startsWith('app/')).map((f) => f.slice(4, -3)))];
    assert.deepEqual(nomes(servicos).sort(), doCatalogo.sort(), 'os serviços do sw.js são os ficheiros de app/ do catálogo');
    // e juntas são o que o index.html carrega de app/
    const html = ler('web/index.html');
    const deApp = (html.match(/src="app\/([^"]+)\.js"/g) || []).map((s) => s.slice(9, -4));
    assert.deepEqual(nomes(app).sort(), deApp.sort());
  });
});

describe('o capital em dívida chega certo por todos os caminhos', () => {
  /* A casa como um aparelho a gravou por cima: o capital do início, e o
     capital em dívida de ANTES da prestação que o outro aparelho registou. */
  const CASA = () => ({ id: 'P1', name: 'Casa', ownerIds: ['O1'], loans: [{ id: 'L1', name: 'Aquisição', capitalInicio: 100000, outstanding: 100000, years: 30, rate: 3, start: '2025-01-01' }] });
  const PRESTACAO = () => ({ id: 'T1', kind: 'loan', label: 'Prestação', amount: 500, principal: 240, interest: 250, stamp: 10, propertyId: 'P1', loanId: 'L1', date: '2026-01-05' });
  const BASE_GRAVADA = () => ({ properties: [CASA()], transactions: [PRESTACAO()], owners: [{ id: 'O1', name: 'Ana' }], contracts: [], tenants: [] });

  // achado A.2-5b
  test('pelo load(): no arranque — o dados.js lê o aparelho antes de o credito.js chegar — e depois dele, que é o caminho das cópias', () => {
    const KEY = carregarApp().KEY;
    const app = carregarApp({ antes: (janela) => janela.localStorage.setItem(KEY, JSON.stringify(BASE_GRAVADA())) });
    assert.equal(app.db.properties[0].loans[0].outstanding, 99760, 'no arranque');
    app.localStorage.setItem(KEY, JSON.stringify(BASE_GRAVADA()));
    assert.equal(app.load().properties[0].loans[0].outstanding, 99760, 'num load() mais tarde');
    assert.equal(app.normalizarBase(BASE_GRAVADA()).properties[0].loans[0].outstanding, 99760, 'e no normalizarBase, por onde passa o bkLoad');
    // com os Créditos desligados: a conta é da base e não rebenta
    const soBase = carregarBase();
    assert.equal(soBase.normalizarBase(BASE_GRAVADA()).properties[0].loans[0].outstanding, 99760, 'sem os Créditos, na mesma');
  });

  // achado A.2-5b
  test('pelo applyState: a casa do servidor com o capital de antes chega certa, e sobe corrigida no envio seguinte', () => {
    const app = carregarTudo();
    app.render = () => {}; app.buildNav = () => {}; app.setSyncBadge = () => {};
    app.fetch = () => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({}), text: () => Promise.resolve('{}') });
    app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt' };
    const casa = Object.assign(CASA(), { ownerIds: ['EU'] });
    const st = {
      me: { id: 'EU', email: 'eu@x.pt', name: 'Eu' }, servicos: { desligados: [] },
      profiles: [{ userId: 'EU', name: 'Eu', data: { id: 'EU', name: 'Eu' } }], people: [{ id: 'EU', name: 'Eu', kind: 'owner' }], proposals: [],
      houses: [{ id: 'P1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], collaborators: [], updatedAt: 1, data: casa }],
      records: [{ houseId: 'P1', kind: 'tx', id: 'T1', updatedAt: 1, author: 'EU', createdBy: 'EU', data: PRESTACAO() }],
      userRecords: [{ kind: 'settings', id: 'main', updatedAt: 1, data: {} }],
      roles: [], collaborators: [], invites: [], shareLink: null, shareRequests: { incoming: [], outgoing: [] }, connections: [],
    };
    app.applyState(copia(st));
    app.clearTimeout(app.pushTimer);
    assert.equal(app.db.properties[0].loans[0].outstanding, 99760, 'o abate da prestação volta');
    const map = app.exportEntities();
    assert.equal(map['h:P1'].data.loans[0].outstanding, 99760, 'a casa exporta-se com o capital certo');
    assert.notEqual(app.snap['h:P1'], app.resumoDeTexto(JSON.stringify(map['h:P1'].data)),
      'o retrato é o que o servidor tem: a casa corrigida sobe no envio seguinte');
  });
});

describe('o formulário do movimento abre-se de uma maneira', () => {
  // achado A.2-9b
  test('só por objeto (e pela forma curta, um id sozinho): a posicional saiu, com o adaptador e os chamadores', () => {
    assert.doesNotMatch(ler('web/app/movimento.js'), /txModalPosicional/);
    const fora = [];
    for (const f of jsDe('web')) {
      semComentarios(f).split('\n').forEach((l, i) => {
        if (/^function txModal\(/.test(l.trim())) return;
        for (const m of l.matchAll(/\btxModal\((.)/g)) if (m[1] !== '{') fora.push(f + ':' + (i + 1) + ' ' + l.trim().slice(0, 90));
      });
    }
    assert.deepEqual(fora, [], 'em web/, todas as chamadas levam um objeto');
    const doc = ler('web/app/movimento.js').match(/\/\*((?:(?!\*\/)[\s\S])*)\*\/\nfunction txModal\(/);
    assert.ok(doc && /forma curta/.test(doc[1]) && /txModal\(id\)/.test(doc[1]), 'a regra está escrita no comentário do txModal');

    const app = carregarApp(); limpar(app); janelas(app);
    app.db.properties = [app.normProp({ id: 'P1', name: 'Casa' })];
    app.db.transactions = [app.normTx({ id: 'T1', kind: 'expense', label: 'Luz', amount: 30, propertyId: 'P1', date: '2026-03-01' })];
    app.txModal('T1');
    assert.equal(app.tForm.id, 'T1', 'um id sozinho abre esse movimento');
    app.txModal({ kind: 'expense', propId: 'P1' });
    assert.equal(app.tForm.propertyId, 'P1'); assert.equal(app.tForm.kind, 'expense'); assert.equal(app.tForm._edit, false, 'um novo');
    assert.throws(() => app.txModal(null, 'expense', 'P1'), /objeto/, 'a forma por posições rebenta alto, em vez de abrir outro formulário');
  });
});

describe('os vazios e o painel de análise, partilhados', () => {
  // achado A.2-14
  test('«Nada neste filtro», a frase de quem liga um serviço e o seletor de proprietário da análise escrevem-se num sítio só', () => {
    const onde = (re) => jsDe('web/app').filter((f) => re.test(ler(f)));
    assert.deepEqual(onde(/<b>Nada neste filtro<\/b><div/), ['web/app/vistas.js']);
    assert.deepEqual(onde(/O suporte pode ligá-lo quando quiseres/), ['web/app/servicos.js']);
    assert.deepEqual(onde(/sel\('ownerSel'/), ['web/app/vistas.js']);
  });

  // achado A.2-14
  test('as vistas continuam a pintá-los: o vazio com o Limpar, a frase com o nome do serviço, e o painel com os dois seletores', () => {
    const app = carregarApp(); limpar(app);
    app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana' }), app.normPerson({ id: 'O2', name: 'Rui' })];
    app.db.properties = [app.normProp({ id: 'P1', name: 'Casa', ownerIds: ['O1', 'O2'] })];
    assert.match(app.vazioFiltro(), /Nada neste filtro/); assert.match(app.vazioFiltro(), /limparFiltroAtual\(\)/);
    for (const [nome, h] of [['dashBar', app.dashBar()], ['vProjections', app.vProjections()], ['vReports', app.vReports()]]) {
      assert.match(h, /id="selb_ownerSel"|'ownerSel'/, nome + ': o seletor de proprietário');
      assert.match(h, /Todos os imóveis/, nome + ': o de imóvel');
    }
    assert.match(app.vFisco(), /Todos os proprietários/, 'a Declaração: o titular, sem grupos');
    // sem imóveis e com os Imóveis desligados: a frase diz o nome e quem liga
    app.db.properties = [];
    app.definirServicosDesligados(['properties']);
    assert.match(app.vReports(), /O serviço Imóveis está desligado nesta conta\. O suporte pode ligá-lo quando quiseres\./);
    assert.match(app.fraseServicoDesligado('contracts'), /^O serviço Contratos está desligado nesta conta\. O suporte/);
  });
});

describe('uma raiz só nas Definições', () => {
  const portas = (h) => [...h.matchAll(/goSet\('([^']+)'\)/g)].map((m) => m[1]);
  // o display:block do rótulo de cada linha da raiz é hoje a classe utilitária u-d-block (definicoes.js:navRow)
  const rotulos = (h) => [...h.matchAll(/<b class="u-d-block">([^<]+)<\/b>/g)].map((m) => m[1]);

  // achado A.3-12
  test('com a nuvem carregada, a raiz tem a porta de cada subpágina da base e as da nuvem, e os caminhos que a app ensina existem', () => {
    const app = carregarTudo();
    app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt' };
    app.setPage = '';
    const h = app.vSettings(), p = portas(h);
    for (const x of ['tema', 'defaults', 'cats', 'irs', 'tags', 'groups', 'filtros', 'dados', 'cloud', 'ajuda', 'faq', 'novidades', 'legal']) {
      assert.ok(p.includes(x), 'a porta de «' + x + '»: ' + p.join(' '));
    }
    for (const x of Object.keys(copia(app.SUBPAGE))) if (!['termos', 'privacidade'].includes(x)) assert.ok(p.includes(x), 'a subpágina «' + x + '» tem porta');
    assert.equal(p.length, new Set(p).size, 'sem portas repetidas');
    assert.match(h, /CW\.editProfile\(\)/, 'o perfil');
    assert.match(h, /<span>Versão<\/span>/, 'e um cartão Sobre só');
    assert.equal((h.match(/<span>Versão<\/span>/g) || []).length, 1);
    // o que as novidades e o aviso legal mandam procurar em «Definições → …»
    const r = rotulos(h), textos = ler('web/avisos.js') + ler('web/legal.js');
    for (const x of ['IRS e dedução', 'Filtros comuns', 'Conta e partilha', 'Perguntas frequentes', 'Ajuda e sugestões', 'Novidades', 'Importar e cópias']) {
      assert.ok(textos.includes('Definições → ' + x) || textos.includes('Definições → <b>' + x), 'controlo: a app manda a «' + x + '»');
      assert.ok(r.includes(x), '«Definições → ' + x + '» existe na raiz: ' + r.join(' | '));
    }
  });

  // achado A.3-12
  test('sem a nuvem é a mesma raiz: a base declara as linhas e a nuvem só acrescenta as dela', () => {
    const app = carregarApp();
    app.setPage = '';
    const p = portas(app.vSettings());
    for (const x of ['tema', 'defaults', 'cats', 'irs', 'tags', 'groups', 'filtros', 'dados']) assert.ok(p.includes(x), x);
    assert.ok(!p.includes('cloud'), 'a conta é da nuvem');
    app.setPage = 'tema';
    assert.match(app.vSettings(), /setTheme\('dark'\)/, 'a subpágina do Tema é da base');
    for (const f of ['web/cloud/partilha.js', 'web/cloud/novidades.js']) {
      assert.doesNotMatch(ler(f), /h = sect\(|h\.replace\(/, f + ' não escreve a raiz por cima');
      assert.match(ler(f), /linhaDefinicoes\(/, f + ' acrescenta as linhas dela');
    }
  });
});

describe('a pasta cloud/', () => {
  // achado A.3-16b
  test('o index.html diz o que junta a pasta — a ordem de carregamento, e não a rede — e nomeia cada ficheiro dela', () => {
    const html = ler('web/index.html');
    const i = html.indexOf('<script src="cloud/nucleo.js">');
    const nota = html.slice(html.lastIndexOf('<!--', i), i);
    assert.match(nota, /SEGUNDA CAMADA/);
    assert.match(nota, /ordem/);
    for (const f of jsDe('web/cloud')) {
      const n = f.slice('web/cloud/'.length, -3);
      assert.match(nota, new RegExp('(^|[^\\w-])' + n + '([^\\w-]|$)'), n + ' está dito na nota');
    }
    // os que a nota diz estarem lá pela ordem são de um serviço do catálogo, ou da base
    const deServico = new Set(SERVICOS_FICHEIROS.flatMap((s) => s.ficheiros));
    for (const n of ['painel', 'selecao', 'selecao-listas']) assert.ok(deServico.has('cloud/' + n + '.js'), n + ' tem serviço no catálogo');
  });
});
