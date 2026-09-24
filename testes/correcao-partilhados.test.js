// Os testes partilhados: as armações num sítio só (testes/lib), um arnês que
// isola um teste do outro, dá à app um dia fixo, lembra-se do que ela
// escreveu no DOM e não finge trocar o que não troca, e os limiares da
// cobertura com o cliente dentro. Cada teste diz a regra; o achado da
// avaliação de 2026-09-14 que a encontrou por cumprir vai num comentário por
// cima dele.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as arnes from './arnes.js';

const require = createRequire(import.meta.url);
const RAIZ = new URL('../', import.meta.url);
// o texto de um ficheiro, com os fins de linha da casa (nesta máquina saem com CRLF)
const ler = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8').replace(/\r\n/g, '\n');
const TESTES = readdirSync(new URL('testes/', RAIZ)).filter((f) => f.endsWith('.test.js')).sort();

/* Os nomes declarados na coluna zero de um ficheiro (function, async function
   e const): as armações de ficheiro, as que se copiavam.
   Recebe: src — o texto do ficheiro.
   Devolve: os nomes, pela ordem. */
function deTopo(src) {
  return [...src.matchAll(/^(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=)/gm)].map((m) => m[1] || m[2]);
}

/* As armações que cada ficheiro reescrevia e que vivem agora em testes/lib (e
   no arnês): as do servidor, que só os testes do servidor declaravam, e as do
   DOM, que qualquer um declarava. */
const DO_SERVIDOR = ['ambiente', 'conta', 'pedir', 'resp', 'estado', 'sync', 'casa', 'registo', 'comproprietario',
  'cargo', 'convidar', 'aceitar', 'darCargo', 'auditoria', 'desligar', 'ligarTudo', 'dadoGlobal', 'fotografia', 'TABELAS',
  'chamar', 'corpoDe', 'novaConta', 'MASTER', 'SUPORTE', 'DEV', 'ADMIN', 'SEM_CARGO'];
const DO_DOM = ['comDom', 'janelasFalsas', 'camadaFalsa', 'menuDe', 'rotulosDoMenu', 'perto', 'lerCatalogo'];
// um teste do servidor é o que usa o duplo da D1
const doServidor = (src) => /from '\.\/lib\/(bd|api)\.js'/.test(src);

describe('as armações vivem num sítio só', () => {
  // achado A.6-7
  test('nenhum ficheiro de teste declara uma armação que testes/lib ou o arnês já dão', () => {
    const copias = [];
    for (const f of TESTES) {
      const src = ler('testes/' + f);
      const nomes = new Set(deTopo(src));
      for (const n of DO_DOM) if (nomes.has(n)) copias.push(f + ': ' + n);
      if (doServidor(src)) for (const n of DO_SERVIDOR) if (nomes.has(n)) copias.push(f + ': ' + n);
    }
    assert.deepEqual(copias, [], 'armações copiadas em vez de importadas de testes/lib');
  });

  // achado A.6-7
  test('o catálogo dos serviços lê-se num sítio só, e o arnês e o percurso leem o mesmo', () => {
    const { lerCatalogo } = require('./lib/catalogo.cjs');
    const ids = lerCatalogo().map((s) => s.id);
    assert.ok(ids.length >= 14, 'o catálogo tem os serviços: ' + ids.join(', '));
    assert.deepEqual(arnes.SERVICOS_FICHEIROS.map((s) => s.id), ids, 'o arnês lê-o de lá');
    assert.deepEqual(require('./ui/percorrer.js').VISTAS, ids.concat(['settings']), 'e o percurso também');
    for (const rel of ['testes/arnes.js', 'testes/ui/percorrer.js']) {
      assert.doesNotMatch(ler(rel), /const SERVICOS=/, rel + ' não tem a sua cópia da expressão');
      assert.match(ler(rel), /lib\/catalogo\.cjs/, rel + ' usa a partilhada');
    }
  });
});

/* Uma contraprova por armação: cada uma faz o que diz, contra o servidor e a
   base a sério — senão os testes que as importam ficam a provar em cima de
   uma armação vazia. */
describe('as armações do servidor fazem o que dizem', () => {
  // achado A.6-7
  test('conta cria uma conta com sessão que a API aceita, com o plano e a palavra-passe pedidos; sem sessão, a API recusa', async () => {
    const { ambiente, conta, pedir, resp, estado } = await import('./lib/api.js');
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const st = await estado(env, A);
    assert.equal(st.status, 200);
    assert.equal(st.me.id, A.id);
    assert.equal((await resp(pedir(env, null, '/api/state'))).status, 401, 'sem sessão não há estado');
    const linha = await env.DB.prepare('SELECT name, plan FROM users WHERE id = ?').bind(A.id).first();
    assert.equal(linha.name, 'Ana');
    assert.equal(linha.plan, 'free');
    const B = await conta(env, 'Bruno', { plano: 'pro', pass: 'Forte#2026' });
    assert.notEqual(B.id, A.id);
    assert.equal((await env.DB.prepare('SELECT plan FROM users WHERE id = ?').bind(B.id).first()).plan, 'pro');
    assert.equal((await resp(pedir(env, null, '/api/auth/login', 'POST', { email: B.email, password: 'Forte#2026' }))).status, 200,
      'a palavra-passe pedida é a verdadeira');
  });

  // achado A.6-7
  test('casa, registo, sync, comproprietário e cargo montam o que o estado de cada um mostra', async () => {
    const { ambiente, conta, estado, sync, casa, registo, comproprietario, cargo, darCargo } = await import('./lib/api.js');
    const { CARGOS_EXEMPLO } = await import('../worker/src/lib/permissoes.js');
    const env = ambiente();
    const D = await conta(env, 'Dono'), P = await conta(env, 'Par'), C = await conta(env, 'Colab'), N = await conta(env, 'Ninguém');
    await casa(env, D, 'H1', { name: 'T2 Lisboa' });
    await registo(env, 'H1', 'tx', 'x1', { label: 'Renda', amount: 500 }, D);
    assert.deepEqual(await sync(env, D, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'x2', data: { label: 'Luz' } }]), [{ ok: true }]);
    await comproprietario(env, D, P, ['H1']);
    await darCargo(env, D, C, await cargo(env, D, 'Ver tudo', CARGOS_EXEMPLO[2].perms, 'R1'), ['H1']);
    for (const q of [D, P, C]) {
      const st = await estado(env, q);
      assert.ok(st.houses.some((h) => h.id === 'H1'), q.name + ' vê a casa');
      assert.ok(st.records.some((r) => r.kind === 'tx' && r.id === 'x1'), q.name + ' vê o registo');
      assert.ok(st.records.some((r) => r.kind === 'tx' && r.id === 'x2'), q.name + ' vê o que o sync gravou');
    }
    assert.deepEqual((await estado(env, N)).houses, [], 'controlo: quem não tem nada não vê nada');
  });

  // achado A.6-7
  test('desligar e ligarTudo mexem nos serviços da conta, dadoGlobal grava um dado da conta, e a fotografia muda com uma linha nova', async () => {
    const { ambiente, conta, estado, casa, desligar, ligarTudo, dadoGlobal, fotografia, auditoria } = await import('./lib/api.js');
    const { auditar } = await import('../worker/src/lib/auditoria.js');
    const { MASTER } = await import('./lib/equipa.js');
    const env = ambiente();
    const D = await conta(env, 'Dono');
    await desligar(env, D, 'contracts');
    assert.ok((await estado(env, D)).servicos.desligados.includes('contracts'));
    await ligarTudo(env, D);
    assert.deepEqual((await estado(env, D)).servicos.desligados, []);
    await dadoGlobal(env, D, 'profile', 'main', { nif: '123456789' });
    assert.ok((await estado(env, D)).userRecords.some((r) => r.kind === 'profile' && r.data.nif === '123456789'));
    const antes = await fotografia(env);
    await casa(env, D, 'H9');
    const depois = await fotografia(env);
    assert.notDeepEqual(depois.houses, antes.houses, 'a casa nova aparece');
    assert.deepEqual(depois.records, antes.records, 'e o resto fica igual');
    assert.equal((await auditoria(env)).length, 0);
    assert.equal(await auditar(env, MASTER, 'conta.plano', D.id, 'porquê'), true);
    assert.deepEqual((await auditoria(env)).map((r) => r.acao), ['conta.plano'], 'a auditoria lê o rasto, pela ordem');
  });

  // achado A.6-7
  test('chamar fala com o back office como o index.js, com a sessão de equipa; novaConta aparece lá', async () => {
    const { ambiente, novaConta } = await import('./lib/api.js');
    const { chamar, corpoDe, SUPORTE, SEM_CARGO } = await import('./lib/equipa.js');
    const env = ambiente();
    const id = await novaConta(env, { nome: 'Rui' });
    const r = await corpoDe(await chamar(env, SUPORTE, 'GET', '/api/equipa/pessoas/' + id + '/servicos'));
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.servicos) && r.servicos.length >= 14, 'os serviços da conta: ' + JSON.stringify(r));
    assert.equal((await chamar(env, SEM_CARGO, 'GET', '/api/equipa/pessoas/' + id + '/servicos')).status, 403, 'controlo: sem cargo não entra');
  });
});

describe('as armações do DOM fazem o que dizem', () => {
  // achado A.6-7
  test('janelasFalsas empilha e desempilha como a app, com uma camada que responde a qualquer seletor, e cala só o que se pede', async () => {
    const { janelasFalsas } = await import('./lib/dom.js');
    const app = arnes.carregarApp();
    const renderReal = app.render;
    const abertas = janelasFalsas(app, 'save', 'toast');
    const L = app.openModal('Título', '<p>corpo</p>', 'rodapé', 'menu');
    assert.equal(abertas.length, 1);
    assert.equal(app.modalStack.length, 1, 'a camada fica em cima da pilha, onde o onSave a procura');
    assert.equal(L.t, 'Título'); assert.equal(L.b, '<p>corpo</p>'); assert.equal(L.f, 'rodapé'); assert.equal(L.m, 'menu');
    assert.equal(L.el.querySelector('.body'), L.body);
    assert.equal(L.el.querySelector('.foot'), L.foot);
    assert.equal(typeof L.el.querySelector('.titulo-qualquer').innerHTML, 'string', 'um seletor qualquer dá um elemento, não null');
    app.closeModal();
    assert.equal(app.modalStack.length, 0);
    app.openModal('a'); app.openModal('b');
    app.closeAllModals();
    assert.equal(app.modalStack.length, 0);
    assert.equal(app.save(), undefined);
    assert.equal(app.toast('x'), undefined);
    assert.equal(app.render, renderReal, 'o que não se pediu fica como estava');
    arnes.repor(app);
  });

  // achado A.6-7
  test('menuDe devolve os rótulos do toque longo, ou null quando não abre nada, e deixa o lpShow como estava', async () => {
    const { menuDe } = await import('./lib/dom.js');
    const app = arnes.carregarApp();
    arnes.limpar(app);
    const lpShowReal = app.lpShow;
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2' })];
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', rent: 500, start: '2025-01-01' })];
    const rotulos = menuDe(app, 'lpMenu', 'ct:C1');
    assert.ok(Array.isArray(rotulos) && rotulos.includes('Editar contrato'), String(rotulos));
    assert.deepEqual(menuDe(app, app.lpMenu, 'ct:C1'), rotulos, 'pelo nome ou pela função, o mesmo');
    assert.equal(menuDe(app, 'lpMenu', 'ct:nada'), null, 'um contrato que não existe não abre nada');
    assert.equal(app.lpShow, lpShowReal);
  });

  // achado A.6-7
  test('perto aceita dentro da tolerância e falha fora dela, com os dois números à vista', () => {
    arnes.perto(10.004, 10);
    arnes.perto(10.02, 10, 0.05);
    assert.throws(() => arnes.perto(10.02, 10), /esperava 10 \(±0\.01\), veio 10\.02/);
    assert.throws(() => arnes.perto(NaN, 10), /veio NaN/, 'um NaN não passa');
    assert.throws(() => arnes.perto(3, 1, 0.5, 'a renda'), /^AssertionError.*a renda/s);
  });
});

describe('um teste não herda o que outro reatribuiu na app', () => {
  const app = arnes.carregarApp();
  const renderReal = app.render, tabReal = app.tab, getReal = app.document.getElementById;
  afterEach(() => arnes.repor(app));

  // achado A.6-9
  test('um teste troca o render, o separador, o getElementById e cria um nome novo…', () => {
    app.render = () => 'stub';
    app.tab = tabReal + '-outro';
    app.nomeQueNaoExistia = 1;
    app.document.getElementById = () => null;
    assert.equal(app.render(), 'stub');
  });

  // achado A.6-9
  test('… e o teste seguinte encontra cada um como a app o carregou', () => {
    assert.equal(app.render, renderReal);
    assert.equal(app.tab, tabReal);
    assert.equal(app.nomeQueNaoExistia, undefined);
    assert.equal(app.document.getElementById, getReal);
  });

  // achado A.6-9
  test('cada ficheiro com uma app partilhada por vários testes repõe-na depois de cada um', () => {
    const falta = [];
    for (const f of TESTES) {
      const src = ler('testes/' + f);
      let bloco = '';
      for (const l of src.split('\n')) {
        // o bloco de coluna zero onde a linha está: um describe partilha, um test ou uma função não
        if (/^\S/.test(l)) bloco = (/^(describe|test|it)\(/.exec(l) || [])[1] || '';
        const m = /^( {0,2})const (\w+) = carregar(?:App|Tudo|Base|Servico)\(/.exec(l);
        if (m && (m[1] === '' || bloco === 'describe') && !src.includes('afterEach(() => repor(' + m[2] + '))')) falta.push(f + ': ' + m[2]);
      }
    }
    assert.deepEqual(falta, [], 'contextos partilhados sem afterEach(() => repor(app))');
  });
});

describe('o que o arnês não troca, diz', () => {
  // achado A.6-11
  test('trocar uma função que a app declara com const rebenta com o nome dela, em vez de fingir que trocou', () => {
    const app = arnes.carregarApp();
    const real = app.today();
    assert.throws(() => { app.today = () => '1999-01-01'; }, (e) => /today/.test(e.message) && /const/.test(e.message));
    assert.equal(app.today(), real, 'e a original continua lá');
    // o que é function ou let troca-se como sempre
    app.hintServicoDesligado = () => 'trocada';
    assert.equal(vm.runInContext("hintServicoDesligado('contracts')", app.__ctx), 'trocada', 'a app chama a trocada');
  });
});

describe('o DOM do arnês tem memória', () => {
  // achado A.6-12
  test('o mesmo id dá o mesmo elemento: o que a app escreve lê-se depois, o insertAdjacentHTML acrescenta, e limpar esvazia', () => {
    const app = arnes.carregarApp();
    const d = app.document;
    assert.equal(d.getElementById('nav'), d.getElementById('nav'));
    app.buildNav();
    assert.match(d.getElementById('nav').innerHTML, /go\('/, 'o menu que o buildNav escreveu');
    assert.equal(arnes.elementos(app).nav, d.getElementById('nav'), 'elementos(app).nav é o #nav');
    const v = d.getElementById('view');
    v.innerHTML = '<p>a</p>';
    v.insertAdjacentHTML('beforeend', '<p>b</p>');
    v.insertAdjacentHTML('afterbegin', '<p>0</p>');
    assert.equal(v.innerHTML, '<p>0</p><p>a</p><p>b</p>', 'como no browser');
    arnes.limpar(app);
    assert.equal(d.getElementById('view').innerHTML, '', 'cada teste parte de um ecrã vazio');
  });

  // achado A.6-12
  test('nenhum ficheiro de teste remenda o getElementById para lhe dar memória', () => {
    const remendos = TESTES.filter((f) => /getElementById\s*=\s*\(id\)\s*=>\s*\((\w+)\[id\]\s*=\s*\1\[id\]\s*\|\|/.test(ler('testes/' + f)));
    assert.deepEqual(remendos, []);
  });
});

/* O que se prova de dinheiro e de datas não pode mudar com o dia em que a
   bateria corre (a regra do prazos.test.js). */
const DE_DINHEIRO = ['hipotecas', 'retroativas', 'dados', 'fisco', 'avaliacao', 'metricas'];

describe('os testes de dinheiro correm num dia fixo', () => {
  // achado A.6-8
  test('o arnês dá à app um dia fixo: o today(), o YEAR e o new Date() dela marcam esse dia, e o relógio continua a andar', async () => {
    const app = arnes.carregarApp({ hoje: '2027-01-31' });
    assert.equal(app.today(), '2027-01-31');
    assert.equal(app.YEAR, 2027);
    assert.equal(vm.runInContext('new Date().getDate()', app.__ctx), 31);
    assert.equal(vm.runInContext('new Date(2020, 0, 1).getFullYear()', app.__ctx), 2020, 'com argumentos, o Date de sempre');
    const t0 = vm.runInContext('Date.now()', app.__ctx);
    await new Promise((r) => setTimeout(r, 5));
    assert.ok(vm.runInContext('Date.now()', app.__ctx) > t0, 'o Date.now() cresce: os ids e as datas de atualização contam com isso');
    assert.throws(() => arnes.carregarApp({ hoje: '31/01/2027' }), /AAAA-MM-DD/);
  });

  // achado A.6-8
  test('os testes de dinheiro carregam a app num dia fixo e não leem o relógio do sistema', () => {
    for (const f of DE_DINHEIRO) {
      const src = ler('testes/' + f + '.test.js');
      const cargas = src.match(/carregar(?:App|Tudo|Base|Servico)\([^)]*\)/g) || [];
      assert.ok(cargas.length, f + ' carrega a app');
      for (const c of cargas) assert.match(c, /hoje/, f + ': ' + c + ' sem dia fixo');
      assert.doesNotMatch(src, /new Date\(\)|Date\.now\(\)/, f + ' lê o relógio do sistema');
    }
  });
});

describe('os nomes e os cabeçalhos dos testes dizem a regra', () => {
  // achado A.6-13
  test('nenhum teste se chama pelo id de uma revisão, e nenhum cabeçalho promete skip ou aponta para o processo', () => {
    const maus = [];
    for (const f of TESTES) {
      const src = ler('testes/' + f);
      for (const m of src.matchAll(/(?:test|describe)\(\s*(['"`])(.*?)\1/g)) {
        if (/^achados?\b|\bdriver\b|\bledger\b/i.test(m[2])) maus.push(f + ': «' + m[2].slice(0, 60) + '»');
      }
      const cabecalho = (src.match(/^(?:\/\/.*\n)+/) || [''])[0];
      if (/skip|\.unlazy\/|\bdriver\b|\bledger\b|\brevisor\b/i.test(cabecalho)) maus.push(f + ': o cabeçalho');
    }
    assert.deepEqual(maus, []);
  });
});

describe('os limiares da cobertura', () => {
  // achado A.6-4b
  test('são os do dia, medidos com o web/ dentro, inteiros e arredondados para baixo', () => {
    const yml = ler('.github/workflows/testes.yml');
    const passo = /(#[^\n]*\n\s*)+- name: Correr os testes\n\s+run: >-\n((?:[ \t]+\S.*\n)+)/.exec(yml);
    assert.ok(passo, 'o passo «Correr os testes»');
    const linha = passo[2], comentario = passo[0].slice(0, passo[0].indexOf('- name:'));
    const lim = {};
    for (const k of ['lines', 'branches', 'functions']) {
      const m = new RegExp('--test-coverage-' + k + '=(\\d+)\\b').exec(linha);
      assert.ok(m, k + ' com limiar inteiro');
      lim[k] = Number(m[1]);
    }
    const med = /[Mm]edidos a (\d{4}-\d{2}-\d{2}) com o web\/ dentro: ([\d,]+) linhas, ([\d,]+) ramos, ([\d,]+) funções/.exec(comentario.replace(/\s*#\s*/g, ' '));
    assert.ok(med, 'o comentário diz os números medidos com o web/ dentro, e quando');
    const num = (s) => Number(s.replace(',', '.'));
    assert.deepEqual(lim, { lines: Math.floor(num(med[2])), branches: Math.floor(num(med[3])), functions: Math.floor(num(med[4])) });
    assert.doesNotMatch(comentario, /ainda são os de antes/);
    // o que fica de fora do número: só os testes e a configuração do lint — o cliente, o worker e os scripts contam
    const fora = [...linha.matchAll(/--test-coverage-exclude="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(fora, ['testes/**', 'eslint.config.mjs']);
  });
});
