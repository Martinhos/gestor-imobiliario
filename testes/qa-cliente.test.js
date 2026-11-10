// O botão dos tickets de QA (web/cloud/qa.js): só existe fora de produção e
// com sessão; o encaixe na borda mais perto (geometria pura) e a posição
// guardada como lado + fração, reposta noutro tamanho de ecrã; um gesto abaixo
// do limiar é um toque (o clique abre o menu) e acima é um arrasto (o clique
// engole-se); a etiqueta da primeira vez sai ao primeiro arrasto; as setas
// mudam a pílula de sítio; o contexto que vai com o ticket (sem inventar, com
// o rasto cortado); a descrição obrigatória; o envio (POST e depois o PUT da
// captura, e só a captura outra vez quando é ela que falha); a lista (uma
// secção por coluna do kanban, pela ordem do quadro, A fazer sempre e as
// outras só com tickets, as de omissão quando o servidor não as manda, e o
// número dos de A fazer e Auto Tests); o selo com o nome da coluna e a chave
// do cartão; «Mover» (as outras colunas, otimista, reposto ao falhar);
// as secções da lista que abrem e fecham (as de fim e a Para depois
// recolhidas por nascença, o estado guardado no aparelho pelo id da coluna);
// a pega do lado da borda, trocada só ao largar;
// o menu conforme o sítio (na app, Ver a montra e Back office; nas páginas
// públicas, Voltar à app e Back office; no back office, os tickets e, quando a
// app abre daí, Ver a montra e Voltar à app);
// remover com Anular;
// reabrir (só em Human Tests e nas de fim); o HTML gerado sem style= nem on…=, com o texto escapado; o autor
// de uma conta apagada como «Conta apagada»; e a pílula acima das janelas,
// menos das do próprio QA. A app
// inteira, nuvem incluída, com a API e o fetch simulados.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { carregarTudo, limpar, repor, igual } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarTudo();
afterEach(() => repor(app));
// o estado do qa.js e da sessão volta ao do arranque (não passa pelo proxy, por isso o repor não o vê)
afterEach(() => zerar());

/* Devolve o qa.js ao estado de quando carregou: sem pílula, sem tickets,
   sem rascunho, sem posição guardada, e a sessão de volta a produção.
   Devolve: nada. */
function zerar() {
  vm.runInContext('qaRemoverPilula();qaLista={tickets:null,falhou:false,aPedir:null,colunas:null};qaAbertos=null;qaRascunho=null;' +
    'qaCamadaLista=null;qaCamadaTicket=null;qaOcupado={};qaEngoleAte=0;qaArrastouAqui=false;qaContextoGuardado=null;' +
    'qaPonteiro="";qaDobrasAqui={};localStorage.clear();modalStack.length=0;CW.ambiente="producao";CW.user=null;CW._rasto=[];', app.__ctx);
}

/* A sessão de uma conta no ambiente de desenvolvimento.
   Devolve: nada. */
function noDev() {
  app.CW.ambiente = 'percurso';
  app.CW.user = { id: 'u1', name: 'Maria Costa', email: 'maria@rendorium.test' };
}

/* Uma API simulada: guarda cada pedido e responde pelo que o teste disser.
   Recebe: respostas — {'MÉTODO /caminho': valor ou função(dados)} (o caminho
   sem o id também serve, com «:id»).
   Devolve: a lista dos pedidos feitos ([método, caminho, dados]). */
function apiFalsa(respostas = {}) {
  const pedidos = [];
  app.api = (m, p, d) => {
    pedidos.push([m, p, d === undefined ? undefined : JSON.parse(JSON.stringify(d))]);
    const chave = m + ' ' + p, geral = m + ' ' + p.replace(/\/api\/qa\/[^/]+/, '/api/qa/:id');
    const r = chave in respostas ? respostas[chave] : geral in respostas ? respostas[geral] : (m === 'GET' ? { tickets: [] } : { ok: true });
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(typeof r === 'function' ? r(d) : r);
  };
  return pedidos;
}

/* Um evento de ponteiro de brincar.
   Recebe: x, y — onde está o ponteiro; o (opcional) — o que muda (pointerId, type…).
   Devolve: o evento. */
function ponteiro(x, y, o = {}) {
  return Object.assign({ pointerId: 1, button: 0, isPrimary: true, pointerType: 'touch', clientX: x, clientY: y, type: 'pointermove' }, o);
}

/* Um clique de brincar que diz se foi travado.
   Devolve: o evento, com .travado. */
function clique() {
  const e = { travado: false, stopPropagation() { e.travado = true; }, preventDefault() {} };
  return e;
}

const LIMITES = { esq: 12, dir: 378, topo: 12, fundo: 760, pw: 96, ph: 44 };
const T = (id, o = {}) => Object.assign({ id, body: 'texto ' + id, severity: null, context: {}, imagem: false, status: 'a-fazer', cartao: null,
  resolution: null, resolved_at: null, created_at: 1, updated_at: 1, autor: { id: 'u2', nome: 'Rui Lopes', email: 'rui@rendorium.test' } }, o);
// as colunas do kanban como o GET /api/qa as manda (as fixas e a Para depois, pela ordem do quadro)
const COLUNAS = [
  { id: 'a-fazer', nome: 'A fazer', fim: false }, { id: 'auto-tests', nome: 'Auto Tests', fim: false },
  { id: 'human-tests', nome: 'Human Tests', fim: false }, { id: 'concluido', nome: 'Concluído', fim: true },
  { id: 'para-depois', nome: 'Para depois', fim: false },
];
/* Uma ordem de pedaços no HTML: cada um existe e vem depois do anterior.
   Recebe: h — o HTML; pedacos — os textos, pela ordem esperada.
   Devolve: nada (falha o teste). */
function pelaOrdem(h, pedacos) {
  const ordem = pedacos.map((x) => h.indexOf(x));
  assert.ok(ordem.every((v, i) => v > -1 && (i === 0 || v > ordem[i - 1])), 'pela ordem: ' + pedacos.map((x, i) => x + '@' + ordem[i]).join(', '));
}
const SEM_EM_LINHA = /\sstyle=|\son[a-z]+\s*=/i;

describe('a pílula só fora de produção', () => {
  test('em produção, ou sem sessão, não há pílula; no dev, com sessão, há — no body, com o menu da casa', () => {
    apiFalsa();
    assert.equal(app.qaSincronizar(), false, 'produção');
    assert.equal(app.qaPil, null);
    app.CW.ambiente = 'percurso';
    assert.equal(app.qaSincronizar(), false, 'sem sessão');
    noDev();
    assert.equal(app.qaSincronizar(), true);
    const p = app.qaPil;
    assert.ok(p && p.id === 'qaPilula', 'a pílula existe');
    assert.ok(app.document.body.children.includes(p), 'e está no body');
    assert.match(p.innerHTML, /data-click="menuOpen\(event,'qa'\);qaMenuAbriu\(event\)"/, 'o botão abre o menu da casa');
    assert.match(p.innerHTML, /id="menu_qa"/);
    assert.match(p.innerHTML, /Novo ticket/);
    assert.match(p.innerHTML, /Ver tickets/);
    assert.match(p.innerHTML, /class="qa-pega"/, 'a pega de pontos');
    assert.match(p.innerHTML, />QA</);
    app.CW.ambiente = 'producao';
    assert.equal(app.qaSincronizar(), false, 'o ambiente voltou a produção');
    assert.equal(app.qaPil, null, 'e a pílula saiu');
  });

  test('na app o menu leva à montra (o /montra, neste separador); no back office só quando a app abre daí', () => {
    apiFalsa();
    noDev();
    assert.equal(app.qaSincronizar(), true);
    assert.match(app.qaPil.innerHTML, /class="qa-menu-montra"[^>]*data-click="closePops\(\);qaVerMontra\(\)"[^>]*>[\s\S]*? Ver a montra<\/button>/);
    const antes = app.location.href;
    try {
      app.qaVerMontra();
      assert.equal(app.location.href, '/montra');
    } finally { app.location.href = antes; }
    // no back office a camada define o QA_EQUIPA; sem o app (a sessão de lá não passa a porta do dev) não há montra
    vm.runInContext('globalThis.QA_EQUIPA = { ambiente: "dev" };', app.__ctx);
    try {
      assert.equal(app.qaNaEquipa(), true);
      assert.doesNotMatch(app.qaHtmlMenu(0), /Ver a montra|qaVerMontra/);
      assert.match(app.qaHtmlMenu(0), /Novo ticket[\s\S]*Ver tickets/, 'as outras duas continuam');
    } finally { vm.runInContext('delete globalThis.QA_EQUIPA;', app.__ctx); }
    // com o app (a porta do dev deixa abrir a app), a montra aparece também no back office
    vm.runInContext('globalThis.QA_EQUIPA = { ambiente: "dev", app: true };', app.__ctx);
    try {
      assert.match(app.qaHtmlMenu(0), /class="qa-menu-montra"[^>]*data-click="closePops\(\);qaVerMontra\(\)"/);
    } finally { vm.runInContext('delete globalThis.QA_EQUIPA;', app.__ctx); }
    assert.equal(app.qaNaEquipa(), false);
  });

  /* Os rótulos dos botões de um menu, sem os ícones.
     Recebe: h — o HTML do menu.
     Devolve: a lista dos textos. */
  const rotulos = (h) => [...h.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<svg[\s\S]*?<\/svg>/g, '').trim());

  test('o menu conforme o sítio: a app com a montra e o Back office, as páginas com Voltar à app e o Back office, o back office com os tickets e, se a app abre daí, a montra e a volta à app', () => {
    apiFalsa();
    noDev();
    // na app
    assert.equal(app.qaLugar(), 'app');
    const naApp = app.qaHtmlMenu(2);
    assert.deepEqual(rotulos(naApp), ['Novo ticket', 'Ver tickets (2)', 'Ver a montra', 'Back office']);
    assert.ok(naApp.includes(app.ic('door', 17) + ' Ver a montra'), 'a montra com a porta');
    assert.ok(naApp.includes(app.ic('users', 17) + ' Back office'), 'o back office com a equipa');
    assert.match(naApp, /class="qa-menu-equipa" data-toca="camada" data-click="closePops\(\);qaBackOffice\(\)"/);
    assert.doesNotMatch(naApp, /Voltar à app|qaVoltarApp/);
    const antes = app.location.href;
    try {
      app.qaBackOffice();
      assert.equal(app.location.href, '/equipa', 'o Back office abre o /equipa, neste separador');
      app.qaVerMontra();
      assert.equal(app.location.href, '/montra', 'e o Ver a montra continua');
    } finally { app.location.href = antes; }
    // nas páginas públicas (a montra e o guia), a camada define o QA_PAGINAS
    vm.runInContext('globalThis.QA_PAGINAS = { ambiente: "dev" };', app.__ctx);
    try {
      assert.equal(app.qaLugar(), 'paginas');
      assert.equal(app.qaNaEquipa(), false);
      const nasPaginas = app.qaHtmlMenu(null);
      assert.deepEqual(rotulos(nasPaginas), ['Novo ticket', 'Ver tickets', 'Voltar à app', 'Back office']);
      assert.ok(nasPaginas.includes(app.ic('home', 17) + ' Voltar à app'), 'a app com a casa');
      assert.match(nasPaginas, /class="qa-menu-app" data-toca="camada" data-click="closePops\(\);qaVoltarApp\(\)"/);
      assert.doesNotMatch(nasPaginas, /Ver a montra|qaVerMontra/, 'já se está na montra');
      try {
        app.qaVoltarApp();
        assert.equal(app.location.href, '/', 'Voltar à app vai para o /');
      } finally { app.location.href = antes; }
    } finally { vm.runInContext('delete globalThis.QA_PAGINAS;', app.__ctx); }
    // no back office, a camada define o QA_EQUIPA: sem o app, só os tickets
    vm.runInContext('globalThis.QA_EQUIPA = { ambiente: "dev" };', app.__ctx);
    try {
      assert.equal(app.qaLugar(), 'equipa');
      assert.deepEqual(rotulos(app.qaHtmlMenu(0)), ['Novo ticket', 'Ver tickets (0)']);
      assert.doesNotMatch(app.qaHtmlMenu(0), /Back office|Voltar à app|Ver a montra/);
    } finally { vm.runInContext('delete globalThis.QA_EQUIPA;', app.__ctx); }
    // dados que não chegaram (QA_EQUIPA nulo) também ficam só com os tickets
    vm.runInContext('globalThis.QA_EQUIPA = null;', app.__ctx);
    try {
      assert.deepEqual(rotulos(app.qaHtmlMenu(0)), ['Novo ticket', 'Ver tickets (0)']);
    } finally { vm.runInContext('delete globalThis.QA_EQUIPA;', app.__ctx); }
    // com o app (a sessão de teste abre a app), a montra e a volta à app, sem o Back office
    vm.runInContext('globalThis.QA_EQUIPA = { ambiente: "dev", app: true };', app.__ctx);
    try {
      const naEquipa = app.qaHtmlMenu(0);
      assert.deepEqual(rotulos(naEquipa), ['Novo ticket', 'Ver tickets (0)', 'Ver a montra', 'Voltar à app']);
      assert.ok(naEquipa.includes(app.ic('door', 17) + ' Ver a montra'), 'a montra com a porta');
      assert.ok(naEquipa.includes(app.ic('home', 17) + ' Voltar à app'), 'a app com a casa');
      assert.match(naEquipa, /class="qa-menu-app" data-toca="camada" data-click="closePops\(\);qaVoltarApp\(\)"/);
      assert.doesNotMatch(naEquipa, /Back office|qaBackOffice/, 'já se está no back office');
    } finally { vm.runInContext('delete globalThis.QA_EQUIPA;', app.__ctx); }
    assert.equal(app.qaLugar(), 'app');
  });

  test('o render traz a pílula quando o ambiente chega do servidor', () => {
    apiFalsa();
    limpar(app);
    noDev();
    app.render();
    assert.ok(app.qaPil, 'o embrulho do render sincroniza a pílula');
  });
});

describe('o encaixe e a posição', () => {
  test('larga-se: cola à borda mais perto do centro, à altura do largar, presa às margens', () => {
    igual(app.qaEncaixe({ x: 40, y: 300 }, LIMITES), { lado: 'esq', fracao: 0.4091, x: 12, y: 300 });
    igual(app.qaEncaixe({ x: 200, y: 300 }, LIMITES), { lado: 'dir', fracao: 0.4091, x: 282, y: 300 });
    igual(app.qaEncaixe({ x: 100, y: -50 }, LIMITES), { lado: 'esq', fracao: 0, x: 12, y: 12 }, 'acima do topo fica no topo');
    igual(app.qaEncaixe({ x: 300, y: 2000 }, LIMITES), { lado: 'dir', fracao: 1, x: 282, y: 716 }, 'abaixo do fundo fica no fundo (acima da barra)');
  });

  test('a posição é lado + fração: reposta noutro tamanho de ecrã, fica na mesma borda e à mesma proporção', () => {
    const pequeno = app.qaPosicaoDe({ lado: 'dir', y: 0.5 }, LIMITES);
    igual(pequeno, { x: 282, y: 364 });
    const deitado = app.qaPosicaoDe({ lado: 'dir', y: 0.5 }, { esq: 12, dir: 832, topo: 12, fundo: 378, pw: 96, ph: 44 });
    igual(deitado, { x: 736, y: 173 });
    igual(app.qaPosicaoDe({ lado: 'esq', y: 9 }, LIMITES), { x: 12, y: 716 }, 'uma fração fora de 0 a 1 é presa');
  });

  test('guarda-se no aparelho e lê-se de volta; estragada ou ausente, vale a inicial (à direita, acima da barra)', () => {
    igual(app.qaLerPosicao(), { lado: 'dir', y: 0.8 });
    app.qaGuardarPosicao({ lado: 'esq', y: 0.25 });
    igual(app.qaLerPosicao(), { lado: 'esq', y: 0.25 });
    app.localStorage.setItem('gi_qa_posicao', '{isto não é json');
    igual(app.qaLerPosicao(), { lado: 'dir', y: 0.8 });
    app.localStorage.setItem('gi_qa_posicao', JSON.stringify({ lado: 'cima', y: 0.3 }));
    igual(app.qaLerPosicao(), { lado: 'dir', y: 0.8 });
  });

  test('a pílula reencaixa quando a janela muda de tamanho', () => {
    apiFalsa();
    noDev();
    app.qaSincronizar();
    igual(app.qaXY, { x: 1200 - 12 - 96, y: Math.round(12 + (900 - 12 - 44 - 12) * 0.8) });
    app.innerWidth = 390;
    app.qaReencaixar();
    assert.equal(app.qaXY.x, 390 - 12 - 96, 'à direita do ecrã novo');
  });
});

describe('o gesto', () => {
  test('abaixo do limiar é um toque: não mexe, não guarda, e o clique segue para o menu', () => {
    apiFalsa();
    noDev();
    app.qaSincronizar();
    const antes = JSON.parse(JSON.stringify(app.qaXY));
    app.qaPousar(ponteiro(1100, 700, { type: 'pointerdown' }));
    app.qaArrastoMove(ponteiro(1106, 705));
    app.qaArrastoFim(ponteiro(1106, 705, { type: 'pointerup' }));
    igual(app.qaXY, antes);
    assert.equal(app.localStorage.getItem('gi_qa_posicao'), null, 'nada guardado');
    const c = clique();
    assert.equal(app.qaEngoleClique(c), false);
    assert.equal(c.travado, false, 'o clique chega ao botão: abre o menu');
    assert.equal(app.qaEtiquetaVisivel(), true, 'um toque não tira a etiqueta');
  });

  test('acima do limiar é um arrasto: segue o ponteiro, encaixa na borda mais perto, guarda, e o clique engole-se', () => {
    apiFalsa();
    noDev();
    app.qaSincronizar();
    app.qaPousar(ponteiro(1100, 700, { type: 'pointerdown' }));
    app.qaArrastoMove(ponteiro(1080, 690, { pointerId: 2 }));
    assert.equal(app.qaArr.ativo, false, 'outro ponteiro não conta');
    app.qaArrastoMove(ponteiro(700, 400));
    assert.equal(app.qaArr.ativo, true);
    igual(app.qaXY, { x: 692, y: 378 }, 'segue o ponteiro');
    app.qaArrastoMove(ponteiro(300, 300));
    app.qaArrastoFim(ponteiro(300, 300, { type: 'pointerup' }));
    igual(app.qaXY, { x: 12, y: 278 }, 'colou à esquerda, à altura do largar');
    const g = JSON.parse(app.localStorage.getItem('gi_qa_posicao'));
    assert.equal(g.lado, 'esq');
    assert.ok(Math.abs(g.y - (278 - 12) / (900 - 12 - 44 - 12)) < 0.001, 'a fração guardada: ' + g.y);
    const c = clique();
    assert.equal(app.qaEngoleClique(c), true, 'o clique a seguir ao arrasto não abre o menu');
    assert.equal(c.travado, true);
    assert.equal(app.qaEngoleClique(clique()), false, 'e só esse');
  });

  test('a etiqueta «Arrasta para mudar de sítio» aparece até ao primeiro arrasto, e depois não volta', () => {
    assert.equal(app.qaEtiquetaVisivel(), true);
    assert.match(app.qaHtmlPilula(null, true), /<span class="qa-etiqueta"[^>]*>Arrasta para mudar de sítio<\/span>/);
    apiFalsa();
    noDev();
    app.qaSincronizar();
    assert.match(app.qaPil.innerHTML, /qa-etiqueta/, 'na primeira vez está lá');
    app.qaPousar(ponteiro(1100, 700, { type: 'pointerdown' }));
    app.qaArrastoMove(ponteiro(1000, 700));
    app.qaArrastoFim(ponteiro(1000, 700, { type: 'pointerup' }));
    assert.equal(app.qaEtiquetaVisivel(), false);
    assert.equal(app.localStorage.getItem('gi_qa_arrastou'), '1', 'lembrado no aparelho');
    app.qaRemoverPilula();
    app.qaSincronizar();
    assert.doesNotMatch(app.qaPil.innerHTML, /qa-etiqueta/, 'a pílula nova já nasce sem ela');
  });

  test('as setas mudam a pílula de sítio sem rato, e as outras teclas são do botão', () => {
    apiFalsa();
    noDev();
    app.qaSincronizar();
    const ev = (key) => ({ key, preventDefault() { ev.feito = true; } });
    assert.equal(app.qaTecla(ev('ArrowLeft')), true);
    igual(app.qaLerPosicao(), { lado: 'esq', y: 0.8 });
    assert.equal(app.qaXY.x, 12);
    app.qaTecla(ev('ArrowUp'));
    igual(app.qaLerPosicao(), { lado: 'esq', y: 0.75 });
    app.qaTecla(ev('ArrowRight'));
    assert.equal(app.qaLerPosicao().lado, 'dir');
    assert.equal(app.qaTecla(ev('Enter')), false, 'o Enter abre o menu pelo clique do próprio botão');
    assert.equal(app.qaEtiquetaVisivel(), false, 'mudar de sítio pelas setas também conta');
  });
});

describe('o contexto', () => {
  test('leva o ecrã, a janela de cima e a ficha, o tamanho, o tema, o ponteiro e o rasto cortado — e nada inventado', () => {
    limpar(app);
    noDev();
    app.tab = 'contracts';
    app.setPage = '';
    app.CW._rasto = Array.from({ length: 12 }, (_, i) => 'passo ' + i + ' ' + 'x'.repeat(i === 11 ? 300 : 3));
    app.modalStack.push({ title: 'Contrato T1', el: {}, ficha: { editar: { act: "ctModal('c-123')" } } });
    app.qaPonteiro = 'touch';
    const c = app.qaContexto();
    igual(c.ecra, { tab: 'contracts', ficha: { tipo: 'ctModal', id: 'c-123' }, modal: 'Contrato T1' });
    assert.equal(c.ambiente, 'percurso');
    igual(c.janela, { w: 1200, h: 900, dpr: 1 });
    igual(c.tema, { escolhido: db().settings.theme || 'auto', escuro: false });
    assert.equal(c.ponteiro, 'touch');
    assert.equal(c.agente, 'node');
    assert.equal(c.rasto.length, 10, 'as dez últimas');
    assert.equal(c.rasto[0], 'passo 2 xxx');
    assert.equal(c.rasto[9].length, 120, 'cada uma cortada');
    assert.ok(!Number.isNaN(Date.parse(c.quando)));
    assert.ok(!('pagina' in c.ecra) && !('hash' in c.ecra), 'sem página nem endereço, não se escreve nenhum');
    assert.ok(!('forcado' in c.tema), 'fora do Samsung Internet não se diz que pode estar escurecida');
    assert.equal(c.versao, app.VERSAO, 'a versão da app');
    app.modalStack.length = 0;
    const s = app.qaContexto();
    assert.equal(s.ecra.ficha, null);
    assert.equal(s.ecra.modal, null);
  });

  test('o contexto escrito para pessoas aguenta o que vier de outro aparelho', () => {
    const h = app.qaHtmlContexto({ ecra: { tab: 'contracts', modal: '<b>x</b>', ficha: { tipo: {}, id: 'c1' } }, janela: { w: 'a', h: 2 },
      tema: { escolhido: 'dark', escuro: true }, ponteiro: 'pen', rasto: ['→ contracts', 5, null], quando: 'ontem' });
    assert.match(h, /<span>Separador<\/span><b>Contratos<\/b>/);
    assert.match(h, /&lt;b&gt;x&lt;\/b&gt;/, 'o título da janela escapado');
    assert.match(h, /<b>c1<\/b>/, 'da ficha só o que é texto');
    assert.doesNotMatch(h, /Ecrã/, 'um tamanho que não é número não se escreve');
    assert.doesNotMatch(h, /Quando/, 'uma data que não se lê não se escreve');
    assert.match(h, /Escuro, a mostrar escuro/);
    assert.match(h, /Caneta/);
    assert.match(h, /<li>→ contracts<\/li><\/ol>/, 'do rasto só o texto');
    assert.match(app.qaHtmlContexto(null), /não traz contexto/);
    assert.match(app.qaHtmlContexto('lixo'), /não traz contexto/);
  });

  test('abrir o menu guarda o ecrã de agora e pede o número de abertos', async () => {
    const pedidos = apiFalsa({ 'GET /api/qa': { colunas: COLUNAS, tickets: [T('A1'), T('A2', { status: 'auto-tests' }), T('R1', { status: 'human-tests' })] } });
    noDev();
    app.qaSincronizar();
    await app.qaLista.aPedir;
    pedidos.length = 0;
    const m = app.document.getElementById('menu_qa');
    m.classList = { contains: (c) => c === 'on' };
    m.style = {};
    app.qaMenuAbriu({ detail: 0 });
    assert.ok(app.qaContextoGuardado && app.qaContextoGuardado.ecra, 'o contexto ficou guardado');
    assert.equal(app.qaContextoGuardado.ponteiro, 'teclado', 'aberto pelo teclado');
    await app.qaLista.aPedir;
    igual(pedidos.map((p) => p[0] + ' ' + p[1]), ['GET /api/qa']);
    assert.equal(app.qaAbertos, 2);
  });
});

describe('o novo ticket', () => {
  test('a descrição é obrigatória: o erro diz-se junto do campo e nada sai para o servidor', async () => {
    const pedidos = apiFalsa();
    janelasFalsas(app, 'render', 'save');
    const falhas = [];
    app.falhaCampo = (id, msg) => falhas.push([id, msg]);
    noDev();
    app.qaNovoTicket();
    app.document.getElementById('qa_desc').value = '   ';
    assert.equal(await app.qaEnviar(), false);
    igual(falhas, [['qa_desc', 'Escreve o que viste.']]);
    igual(pedidos, []);
  });

  test('o corpo da janela: descrição com * e exemplo, gravidade opcional com «Nenhuma», captura, o que vai junto', () => {
    const h = app.qaHtmlNovo({ ecra: { tab: 'dashboard' } });
    assert.match(h, /Descrição <span class="req">\*<\/span>/);
    assert.match(h, /placeholder="Ex: /);
    assert.match(h, /role="radiogroup"/);
    assert.match(h, /aria-checked="true" data-g="" [^>]*>Nenhuma</);
    ['Bloqueia', 'Incomoda', 'Detalhe'].forEach((g) => assert.match(h, new RegExp('>' + g + '</button>')));
    assert.match(h, /Escolher imagem/);
    assert.match(h, /Ctrl\+V/);
    assert.match(h, /O que vai junto/);
    assert.match(h, /<span>Separador<\/span><b>Visão geral<\/b>/);
  });

  test('enviar: o POST com o texto, a gravidade e o contexto de antes da janela, e depois o PUT da captura', async () => {
    const pedidos = apiFalsa({ 'POST /api/qa': { ok: true, id: 'T1' } });
    const envios = [];
    app.fetch = (url, o) => { envios.push([url, o]); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }); };
    const avisos = [];
    app.toast = (m) => avisos.push(m);
    const abertas = janelasFalsas(app, 'render', 'save');
    noDev();
    app.qaContextoGuardado = { ecra: { tab: 'properties', ficha: null, modal: null }, quando: '2026-10-28T10:00:00.000Z' };
    app.qaNovoTicket();
    assert.equal(abertas[0].t, 'Novo ticket de QA');
    app.document.getElementById('qa_desc').value = '  O gráfico fica em branco.  ';
    app.qaGravidade('bloqueia');
    app.qaGravidade('isto-não');
    const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
    assert.equal(await app.qaReceberImagem(png), true);
    assert.equal(abertas[0].tocado, true, 'com a captura, sair pergunta');
    assert.equal(await app.qaEnviar(), true);
    igual(pedidos[0], ['POST', '/api/qa', { body: 'O gráfico fica em branco.', severity: 'bloqueia',
      context: { ecra: { tab: 'properties', ficha: null, modal: null }, quando: '2026-10-28T10:00:00.000Z' } }]);
    assert.equal(envios.length, 1);
    assert.equal(envios[0][0], '/api/qa/T1/imagem');
    assert.equal(envios[0][1].method, 'PUT');
    assert.equal(envios[0][1].headers['Content-Type'], 'image/png');
    assert.equal(envios[0][1].body, png, 'os bytes da imagem no corpo');
    assert.equal(app.modalStack.length, 0, 'a janela fechou');
    igual(avisos, ['Ticket enviado, com a captura.']);
    assert.ok(pedidos.some((p) => p[0] === 'GET' && p[1] === '/api/qa'), 'e o número de abertos atualiza-se');
  });

  test('se só a captura falha, a janela fica a dizê-lo, e enviar outra vez sobe só a captura', async () => {
    const pedidos = apiFalsa({ 'POST /api/qa': { ok: true, id: 'T9' } });
    let falha = true;
    const envios = [];
    app.fetch = (url) => {
      envios.push(url);
      return Promise.resolve(falha
        ? { ok: false, status: 413, json: () => Promise.resolve({ error: 'A imagem é grande de mais.' }) }
        : { ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
    };
    app.toast = () => {};
    janelasFalsas(app, 'render', 'save');
    noDev();
    app.qaNovoTicket();
    app.document.getElementById('qa_desc').value = 'Com imagem';
    await app.qaReceberImagem(new Blob(['x'], { type: 'image/webp' }));
    assert.equal(await app.qaEnviar(), false);
    const erro = app.document.getElementById('qa_e').textContent;
    assert.match(erro, /ficou guardado, mas a captura não subiu: A imagem é grande de mais\./);
    assert.equal(app.modalStack.length, 1, 'a janela fica aberta');
    assert.equal(app.qaRascunho.id, 'T9');
    falha = false;
    assert.equal(await app.qaEnviar(), true);
    assert.equal(pedidos.filter((p) => p[0] === 'POST').length, 1, 'nenhum ticket repetido');
    igual(envios, ['/api/qa/T9/imagem', '/api/qa/T9/imagem']);
  });

  test('colar uma imagem na janela é a captura; colar texto não lhe toca', async () => {
    apiFalsa();
    janelasFalsas(app, 'render', 'save');
    noDev();
    app.qaNovoTicket();
    let travado = false;
    assert.equal(app.qaColar({ clipboardData: { files: [], items: [{ kind: 'string', type: 'text/plain' }] }, preventDefault() { travado = true; } }), false);
    assert.equal(travado, false);
    const img = new Blob(['p'], { type: 'image/png' });
    assert.equal(app.qaColar({ clipboardData: { files: [img] }, preventDefault() { travado = true; } }), true);
    assert.equal(travado, true);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(app.qaRascunho.imagem, img);
    app.qaRemoverImagem();
    assert.equal(app.qaRascunho.imagem, null);
  });
});

describe('a lista', () => {
  test('uma secção por coluna do kanban, pela ordem que o servidor manda, com o nome e quantos tem; A fazer sempre, as outras só com tickets', async () => {
    const colunas = [COLUNAS[0], COLUNAS[4], COLUNAS[1], COLUNAS[2], { id: 'c0ffee-1', nome: 'Bloqueado', fim: false }, COLUNAS[3]];
    apiFalsa({ 'GET /api/qa': { colunas, tickets: [
      T('N1', { created_at: 100 }), T('N2', { severity: 'bloqueia', created_at: 50, imagem: true }),
      T('E1', { status: 'auto-tests', severity: 'detalhe', created_at: 900 }), T('E2', { status: 'auto-tests', severity: 'bloqueia', created_at: 50 }),
      T('H1', { status: 'human-tests', resolved_at: 300 }), T('H2', { status: 'human-tests', resolved_at: 400 }),
      T('C1', { status: 'concluido', resolved_at: 10 }), T('D1', { status: 'para-depois' }), T('X1', { status: 'esquisito' }),
    ] } });
    noDev();
    app.qaSincronizar();
    await app.qaLista.aPedir;
    const s = app.qaSeccoes(app.qaLista.tickets);
    igual(s.seccoes.map((x) => x.id), ['a-fazer', 'para-depois', 'auto-tests', 'human-tests', 'c0ffee-1', 'concluido', 'esquisito'],
      'a ordem do quadro, e no fim o status que não é uma coluna (o ticket não se perde)');
    igual(s.seccoes.map((x) => x.ts.map((t) => t.id)), [['N2', 'N1'], ['D1'], ['E2', 'E1'], ['H2', 'H1'], [], ['C1'], ['X1']],
      'por gravidade nas por resolver, do resolvido há menos tempo nas resolvidas');
    igual(s.abertos.map((t) => t.id), ['N2', 'N1', 'E2', 'E1'], 'por resolver: A fazer e Auto Tests');
    assert.equal(app.qaAbertos, 4, 'o número da pílula');
    assert.equal(app.qaRotuloDoBotao(app.qaAbertos), 'Tickets de QA, 4 por resolver');
    assert.equal(app.qaRotuloVer(app.qaAbertos), 'Ver tickets (4)');
    const h = app.qaHtmlLista();
    pelaOrdem(h, ['>A fazer<', "qaAbrirTicket('N2')", "qaAbrirTicket('N1')", '>Para depois<', "qaAbrirTicket('D1')",
      '>Auto Tests<', "qaAbrirTicket('E2')", "qaAbrirTicket('E1')", '>Human Tests<', "qaAbrirTicket('H2')", "qaAbrirTicket('H1')",
      '>Concluído<', "qaAbrirTicket('C1')", '>esquisito<', "qaAbrirTicket('X1')"]);
    assert.match(h, /<span class="qa-dobra-nome">Auto Tests<\/span><span class="qa-sec-n">2<\/span>/);
    assert.match(h, /<span class="qa-dobra-nome">Concluído<\/span><span class="qa-sec-n">1<\/span>/);
    assert.doesNotMatch(h, /Bloqueado/, 'uma coluna sem tickets não aparece');
    assert.match(h, /<span class="badge red">Bloqueia<\/span>/, 'o selo da gravidade');
    assert.match(h, /Com captura/, 'o sinal de que traz imagem');
    assert.match(h, /Rui Lopes · /, 'quem o escreveu');
    // sem nenhum em A fazer, a secção fica, a dizê-lo
    app.qaLista.tickets = [T('H9', { status: 'human-tests', resolved_at: 1 })];
    const so = app.qaHtmlLista();
    pelaOrdem(so, ['>A fazer<', 'Nenhum ticket novo.', '>Human Tests<']);
    assert.doesNotMatch(so, />Auto Tests</);
    assert.equal(app.qaSeccoes(app.qaLista.tickets).abertos.length, 0);
  });

  test('sem colunas na resposta (um servidor de antes), as cinco de omissão; Para depois aparece quando tem tickets', async () => {
    apiFalsa({ 'GET /api/qa': { tickets: [T('P1', { status: 'para-depois' }), T('N1')] } });
    await app.qaCarregar();
    igual(app.qaColunas().map((c) => c.nome), ['A fazer', 'Auto Tests', 'Human Tests', 'Concluído', 'Para depois']);
    igual(app.qaColunas().map((c) => c.fim), [false, false, false, true, false]);
    const h = app.qaHtmlLista();
    pelaOrdem(h, ['>A fazer<', "qaAbrirTicket('N1')", '>Para depois<', "qaAbrirTicket('P1')"]);
    assert.doesNotMatch(h, />Auto Tests<|>Human Tests<|>Concluído</);
    assert.equal(app.qaAbertos, 1, 'o de Para depois não conta');
    // o que vem do servidor é validado: ids com a forma de um id de coluna, sem repetidos, com nome
    igual(app.qaColunasDe([{ id: 'a-fazer', nome: 'A fazer' }, { id: 'a-fazer', nome: 'Outra' }, { id: 'mau id!' }, null, { id: 'x1', nome: '  ', fim: 1 }]),
      [{ id: 'a-fazer', nome: 'A fazer', fim: false }, { id: 'x1', nome: 'x1', fim: true }]);
    igual(app.qaColunasDe('lixo').map((c) => c.id), ['a-fazer', 'auto-tests', 'human-tests', 'concluido', 'para-depois']);
  });

  test('o selo do estado diz o nome da coluna: Auto Tests no roxo, Human Tests e as de fim no verde, as outras neutras; e a chave do cartão', () => {
    app.qaLista.colunas = app.qaColunasDe(COLUNAS.concat([{ id: 'f1n4l', nome: 'Arquivado', fim: true }, { id: 'b10c', nome: '<b>Bloqueado</b>' }]));
    assert.equal(app.qaSeloEstado('auto-tests'), '<span class="badge loan">Auto Tests</span>');
    assert.equal(app.qaSeloEstado('human-tests'), '<span class="badge in">Human Tests</span>');
    assert.equal(app.qaSeloEstado('concluido'), '<span class="badge in">Concluído</span>');
    assert.equal(app.qaSeloEstado('f1n4l'), '<span class="badge in">Arquivado</span>', 'uma coluna de fim nova');
    assert.equal(app.qaSeloEstado('a-fazer'), '<span class="badge grey">A fazer</span>');
    assert.equal(app.qaSeloEstado('para-depois'), '<span class="badge grey">Para depois</span>');
    assert.equal(app.qaSeloEstado('esquisito'), '<span class="badge grey">esquisito</span>', 'uma que não se conhece diz o id');
    assert.equal(app.qaSeloEstado('b10c'), '<span class="badge grey">&lt;b&gt;Bloqueado&lt;/b&gt;</span>', 'o nome escapado');
    const comCartao = app.qaHtmlTicket(T('K1', { status: 'auto-tests', cartao: 'KAN-12' }));
    assert.match(comCartao, /<div class="qa-ver-cab"><span class="badge loan">Auto Tests<\/span><span class="small num qa-cartao"[^>]*>KAN-12<\/span><\/div>/);
    assert.doesNotMatch(app.qaHtmlTicket(T('K2')), /qa-cartao/, 'sem cartão, nada');
  });

  test('«Reabrir» só em Human Tests e nas colunas de fim; nas outras, «Fechar»', () => {
    app.qaLista.colunas = app.qaColunasDe(COLUNAS.concat([{ id: 'f1n4l', nome: 'Arquivado', fim: true }]));
    for (const st of ['human-tests', 'concluido', 'f1n4l']) {
      const r = app.qaRodapeTicket(T('Q1', { status: st }));
      assert.match(r, /data-click="qaReabrir\('Q1'\)">Reabrir</, st + ' reabre-se');
      assert.doesNotMatch(r, />Fechar</, st);
    }
    for (const st of ['a-fazer', 'auto-tests', 'para-depois', 'esquisito']) {
      const r = app.qaRodapeTicket(T('Q1', { status: st }));
      assert.doesNotMatch(r, /Reabrir/, st + ' não se reabre');
      assert.match(r, /data-click="closeModal\(\)">Fechar</, st);
    }
    // a resolução: «Resolução» onde está resolvido, «Resolução anterior» nas outras
    assert.match(app.qaHtmlTicket(T('Q2', { status: 'human-tests', resolution: 'Feito', resolved_at: 5 })), /<b>Resolução<\/b>/);
    assert.match(app.qaHtmlTicket(T('Q3', { status: 'auto-tests', resolution: 'Feito' })), /<b>Resolução anterior<\/b>/);
  });

  test('«Mover»: um menu de ações com as outras colunas; o POST à rota certa, otimista, e a lista outra vez', async () => {
    let servidor = 'a-fazer';
    const noPedido = [];
    const pedidos = apiFalsa({
      'GET /api/qa': () => ({ colunas: COLUNAS, tickets: [T('A1', { status: servidor, resolved_at: servidor === 'human-tests' ? 777 : null })] }),
      'POST /api/qa/:id/mover': (d) => {
        const t = app.qaLista.tickets[0];
        noPedido.push([t.status, typeof t.resolved_at, app.qaAbertos]);
        servidor = d.coluna;
        return { ok: true };
      },
    });
    const avisos = [];
    app.toast = (m) => avisos.push(m);
    await app.qaCarregar();
    const rodape = app.qaRodapeTicket(app.qaLista.tickets[0]);
    assert.match(rodape, /<span class="menuwrap qa-mover" data-menu="acoes"><button type="button" class="btn" data-toca="camada" data-click="menuOpen\(event,'qaMover'\)" aria-expanded="false">/);
    assert.match(rodape, /Mover<\/button><div class="menupop" id="menu_qaMover">/);
    const opcoes = [...rodape.matchAll(/data-click="closePops\(\);qaMover\('A1','([\w-]+)'\)">[\s\S]*?<\/svg> ([^<]+)<\/button>/g)].map((m) => m[1] + ' ' + m[2]);
    igual(opcoes, ['auto-tests Auto Tests', 'human-tests Human Tests', 'concluido Concluído', 'para-depois Para depois'], 'as outras colunas, pela ordem do quadro');
    assert.doesNotMatch(rodape, SEM_EM_LINHA);
    pedidos.length = 0;
    assert.equal(await app.qaMover('A1', 'human-tests'), true);
    igual(noPedido, [['human-tests', 'number', 0]], 'otimista: a lista e o número mudaram antes de o servidor responder');
    igual(pedidos[0], ['POST', '/api/qa/A1/mover', { coluna: 'human-tests' }]);
    igual(avisos, ['Ticket movido para Human Tests.']);
    await app.qaLista.aPedir;
    assert.ok(pedidos.some((p) => p[0] === 'GET' && p[1] === '/api/qa'), 'e a lista pede-se outra vez');
    assert.equal(app.qaLista.tickets[0].status, 'human-tests');
    assert.equal(app.qaLista.tickets[0].resolved_at, 777, 'o do servidor');
    assert.match(app.qaRodapeTicket(app.qaLista.tickets[0]), /Reabrir/, 'em Human Tests já se reabre');
    // de uma resolvida para outra que não o é, o resolved_at sai logo
    noPedido.length = 0;
    assert.equal(await app.qaMover('A1', 'auto-tests'), true);
    igual(noPedido, [['auto-tests', 'object', 1]]);
    // um id que não tem a forma de uma coluna nem sai
    pedidos.length = 0;
    assert.equal(await app.qaMover('A1', 'mau id!'), false);
    igual(pedidos, []);
  });

  test('«Mover» que falha: o ticket volta para onde estava, o aviso diz porquê, e um pedido de cada vez', async () => {
    const pedidos = apiFalsa({
      'GET /api/qa': { colunas: COLUNAS, tickets: [T('A1')] },
      'POST /api/qa/:id/mover': Object.assign(new Error('Essa coluna não existe no kanban.'), { status: 400 }),
    });
    const avisos = [];
    app.toast = (m) => avisos.push(m);
    await app.qaCarregar();
    assert.equal(app.qaAbertos, 1);
    pedidos.length = 0;
    const p = app.qaMover('A1', 'concluido');
    assert.equal(app.qaLista.tickets[0].status, 'concluido', 'otimista');
    assert.equal(app.qaAbertos, 0);
    assert.equal(await app.qaMover('A1', 'auto-tests'), false, 'com um pedido a caminho, o segundo não sai');
    assert.equal(await p, false);
    const t = app.qaLista.tickets[0];
    assert.equal(t.status, 'a-fazer', 'voltou para onde estava');
    assert.equal(t.resolved_at, null);
    assert.equal(t.updated_at, 1);
    assert.equal(app.qaAbertos, 1, 'e o número também');
    igual(avisos, ['Essa coluna não existe no kanban.']);
    igual(pedidos.map((x) => x[0] + ' ' + x[1]), ['POST /api/qa/A1/mover'], 'só o pedido que saiu; num 400 a lista não se pede');
    assert.deepEqual(Object.keys(app.qaOcupado), [], 'e o ticket ficou livre');
    // sem frase do servidor, a nossa; num 404 o ticket já não existe e a lista pede-se
    apiFalsa({ 'GET /api/qa': { colunas: COLUNAS, tickets: [] }, 'POST /api/qa/:id/mover': Object.assign(new Error(''), { status: 404 }) });
    assert.equal(await app.qaMover('A1', 'concluido'), false);
    assert.equal(avisos[1], 'Não deu para mover o ticket.');
    await app.qaLista.aPedir;
    igual(app.qaLista.tickets, []);
  });

  test('os de A fazer em grupos por gravidade, cada um com o título e quantos tem, e em cada grupo o mais recente à frente', () => {
    const ts = [
      T('S1', { created_at: 900 }), T('D1', { severity: 'detalhe', created_at: 500 }), T('B1', { severity: 'bloqueia', created_at: 100 }),
      T('I1', { severity: 'incomoda', created_at: 300 }), T('B2', { severity: 'bloqueia', created_at: 200 }), T('S2', { created_at: 50 }),
      T('R1', { status: 'concluido', severity: 'bloqueia', resolved_at: 10 }),
    ];
    const s = app.qaSeccoes(ts);
    igual(s.abertos.map((t) => t.id), ['B2', 'B1', 'I1', 'D1', 'S1', 'S2']);
    igual(s.seccoes.find((x) => x.id === 'concluido').ts.map((t) => t.id), ['R1']);
    const h = app.qaHtmlGrupos(s.abertos);
    const titulos = [...h.matchAll(/<h4 class="qa-grupo"><button [^>]*><span class="qa-dobra-nome">([^<]+)<\/span><span class="qa-grupo-n">(\d+)<\/span>/g)].map((m) => m[1] + ' ' + m[2]);
    igual(titulos, ['Bloqueia 2', 'Incomoda 1', 'Detalhe 1', 'Sem gravidade 2']);
    const ordem = ["qaAbrirTicket('B2')", "qaAbrirTicket('B1')", 'Incomoda', "qaAbrirTicket('I1')", 'Sem gravidade', "qaAbrirTicket('S2')"].map((x) => h.indexOf(x));
    assert.ok(ordem.every((v, i) => v > -1 && (i === 0 || v > ordem[i - 1])), 'pela ordem: ' + ordem.join(', '));
    // só uma gravidade: um grupo só
    assert.equal((app.qaHtmlGrupos(app.qaSeccoes([T('X', { severity: 'detalhe' })]).abertos).match(/qa-grupo"/g) || []).length, 1);
  });

  test('a espera, a falha com «Tentar de novo» e o vazio dizem cada um o que é', async () => {
    assert.match(app.qaHtmlLista(), /À espera do servidor/);
    apiFalsa({ 'GET /api/qa': new Error('sem rede') });
    await app.qaCarregar();
    assert.match(app.qaHtmlLista(), /Não deu para carregar os tickets[\s\S]*qaCarregarDeNovo\(\)/);
    apiFalsa({ 'GET /api/qa': { tickets: [] } });
    await app.qaCarregar();
    assert.match(app.qaHtmlLista(), /Ainda não há tickets/);
    assert.equal(app.qaAbertos, 0);
  });

  test('remover: DELETE, o aviso com Anular, e o Anular repõe-no', async () => {
    const pedidos = apiFalsa({ 'GET /api/qa': { tickets: [T('A1'), T('A2')] } });
    let aviso = null;
    app.toast = (m, op) => { aviso = { m, op }; };
    await app.qaCarregar();
    pedidos.length = 0;
    assert.equal(await app.qaRemover('A1'), true);
    igual(pedidos[0].slice(0, 2), ['DELETE', '/api/qa/A1']);
    assert.equal(aviso.m, 'Ticket removido.');
    assert.equal(aviso.op.rotulo, 'Anular');
    igual(app.qaLista.tickets.map((t) => t.id), ['A2'], 'sai da lista logo');
    await aviso.op.fn();
    assert.ok(pedidos.some((p) => p[0] === 'POST' && p[1] === '/api/qa/A1/repor'), 'o Anular repõe');
  });

  test('reabrir: o POST, volta a A fazer logo (otimista), e a resolução fica como «Resolução anterior»', async () => {
    let reaberto = false, noPedido = null;
    const pedidos = apiFalsa({
      'GET /api/qa': () => ({ colunas: COLUNAS, tickets: [T('R1', reaberto ? { resolution: 'Corrigido em abc123', updated_at: 7 }
        : { status: 'human-tests', resolution: 'Corrigido em abc123', resolved_at: 5 })] }),
      'POST /api/qa/:id/reabrir': () => { noPedido = app.qaLista.tickets[0].status; reaberto = true; return { ok: true }; },
    });
    const avisos = [];
    app.toast = (m) => avisos.push(m);
    await app.qaCarregar();
    const r1 = app.qaLista.tickets[0];
    assert.match(app.qaHtmlTicket(r1), /<b>Resolução<\/b><p>Corrigido em abc123<\/p>/);
    assert.match(app.qaRodapeTicket(r1), /qaReabrir\('R1'\)">Reabrir</);
    assert.equal(app.qaAbertos, 0);
    assert.equal(await app.qaReabrir('R1'), true);
    assert.equal(noPedido, 'a-fazer', 'já estava em A fazer quando o pedido saiu');
    igual(avisos, ['Ticket reaberto.']);
    await app.qaLista.aPedir;
    const reab = pedidos.find((p) => p[0] === 'POST');
    igual(reab.slice(0, 2), ['POST', '/api/qa/R1/reabrir'], 'a rota do reabrir');
    assert.equal(reab[2], undefined, 'sem corpo');
    const agora = app.qaLista.tickets[0];
    assert.equal(agora.status, 'a-fazer');
    assert.equal(app.qaAbertos, 1);
    assert.match(app.qaHtmlTicket(agora), /<b>Resolução anterior<\/b>/);
    assert.doesNotMatch(app.qaRodapeTicket(agora), /Reabrir/, 'em A fazer não se reabre');
    assert.match(app.qaHtmlTicket(agora), /<span class="badge grey">A fazer<\/span>/);
  });

  test('reabrir que falha: o ticket volta a Human Tests e o aviso diz porquê', async () => {
    apiFalsa({
      'GET /api/qa': { colunas: COLUNAS, tickets: [T('R1', { status: 'human-tests', resolved_at: 5 })] },
      'POST /api/qa/:id/reabrir': new Error('Sem ligação ao servidor.'),
    });
    const avisos = [];
    app.toast = (m) => avisos.push(m);
    await app.qaCarregar();
    assert.equal(await app.qaReabrir('R1'), false);
    const t = app.qaLista.tickets[0];
    assert.equal(t.status, 'human-tests');
    assert.equal(t.resolved_at, 5);
    assert.equal(app.qaAbertos, 0);
    igual(avisos, ['Sem ligação ao servidor.']);
  });
});

describe('as secções da lista abrem e fecham', () => {
  const LISTA = [T('B1', { severity: 'bloqueia' }), T('D1', { severity: 'detalhe' }), T('S1'), T('R1', { status: 'concluido', resolved_at: 5 }),
    T('H1', { status: 'human-tests', resolved_at: 6 })];

  /* O estado de cada secção no HTML da lista: a chave e se está aberta, pela
     classe e pelo aria-expanded (que têm de concordar).
     Recebe: h — o HTML da lista.
     Devolve: {chave: true (aberta) ou false}. */
  function estados(h) {
    const r = {};
    for (const m of h.matchAll(/<div class="qa-dobra( fechada)?" id="qaSec-([\w-]+)">[\s\S]*?aria-expanded="(true|false)" aria-controls="qaDobra-([\w-]+)"/g)) {
      assert.equal(m[2], m[4], 'o botão controla o corpo da sua secção');
      assert.equal(!m[1], m[3] === 'true', 'a classe e o aria-expanded de ' + m[2] + ' concordam');
      r[m[2]] = !m[1];
    }
    return r;
  }

  test('por nascença A fazer, os grupos de gravidade e Human Tests abertos, as de fim e a Para depois recolhidas; cada título é um botão que dobra', () => {
    app.qaLista.tickets = LISTA;
    const h = app.qaHtmlLista();
    igual(estados(h), { 'a-fazer': true, 'g-bloqueia': true, 'g-detalhe': true, 'g-sem': true, 'human-tests': true, concluido: false });
    assert.match(h, /<h3 class="qa-sec"><button type="button" class="qa-dobra-cab" id="qaCab-concluido" data-toca="nada" data-click="qaDobrar\('concluido'\)"/);
    assert.match(h, /<span class="qa-dobra-nome">Concluído<\/span><span class="qa-sec-n">1<\/span>/, 'quantos tem vê-se com ela recolhida');
    assert.match(h, /id="qaDobra-concluido"><div class="qa-dobra-itens"><div class="qa-dobra-dentro"><div class="qa-linhas"><button type="button" class="qa-linha"[^>]*qaAbrirTicket\('R1'\)/,
      'recolhida, as linhas continuam no HTML (é a folha que as esconde)');
    assert.doesNotMatch(h, SEM_EM_LINHA);
    app.qaLista.tickets = [T('P1', { status: 'para-depois' })];
    assert.equal(estados(app.qaHtmlLista())['para-depois'], false, 'o que fica para depois nasce recolhido');
    // uma coluna de fim nova (do master) também nasce recolhida
    app.qaLista.colunas = app.qaColunasDe(COLUNAS.concat([{ id: '3f2a-77', nome: 'Arquivado', fim: true }]));
    app.qaLista.tickets = [T('Z1', { status: '3f2a-77', resolved_at: 1 })];
    assert.equal(estados(app.qaHtmlLista())['3f2a-77'], false);
  });

  test('tocar no título troca a secção no nó vivo, guarda no aparelho pelo id da coluna, e a lista repintada nasce igual', () => {
    app.qaLista.tickets = LISTA;
    const sec = app.document.getElementById('qaSec-concluido'), cab = app.document.getElementById('qaCab-concluido');
    const classes = [], attrs = {};
    sec.classList = { toggle(c, on) { classes.push([c, on]); } };
    cab.setAttribute = (k, v) => { attrs[k] = v; };
    assert.equal(app.qaDobrar('concluido'), true, 'Concluído abre');
    igual(classes, [['fechada', false]]);
    igual(attrs, { 'aria-expanded': 'true' });
    assert.equal(app.qaDobrar('g-detalhe'), false, 'um grupo recolhe-se');
    igual(JSON.parse(app.localStorage.getItem('gi_qa_dobras')), { concluido: true, 'g-detalhe': false });
    igual(estados(app.qaHtmlLista()), { 'a-fazer': true, 'g-bloqueia': true, 'g-detalhe': false, 'g-sem': true, 'human-tests': true, concluido: true });
    assert.equal(app.qaDobrar('a-fazer'), false);
    assert.equal(estados(app.qaHtmlLista())['a-fazer'], false, 'A fazer também se recolhe');
    assert.equal(app.qaDobrar('lixo'), null, 'uma chave que não existe não mexe em nada');
    assert.equal(app.qaDobrar('para-depois'), null, 'nem a de uma coluna que não está à vista');
    assert.equal(app.qaDobrar("x'); alert(1); ('"), null);
    const guardado = JSON.parse(app.localStorage.getItem('gi_qa_dobras'));
    assert.ok(!('lixo' in guardado) && !('para-depois' in guardado));
  });

  test('guardado estragado vale a nascença; as chaves de antes não partem nada; com o armazenamento vedado, o toque vale nesta sessão', () => {
    app.qaLista.tickets = LISTA;
    app.localStorage.setItem('gi_qa_dobras', '{isto não é json');
    igual(estados(app.qaHtmlLista()).concluido, false);
    app.localStorage.setItem('gi_qa_dobras', JSON.stringify({ concluido: 'sim', 'a-fazer': false, 'mau id!': true, outra: true }));
    igual(app.qaLerDobras(), { 'a-fazer': false, outra: true }, 'só as chaves com a forma de uma e com true ou false');
    // quem tinha as chaves dos três estados de antes vê a nascença das colunas
    app.localStorage.setItem('gi_qa_dobras', JSON.stringify({ novos: false, 'em-resolucao': false, resolvidos: true }));
    igual(estados(app.qaHtmlLista()), { 'a-fazer': true, 'g-bloqueia': true, 'g-detalhe': true, 'g-sem': true, 'human-tests': true, concluido: false });
    app.localStorage.clear();
    const real = app.localStorage;
    app.localStorage = { getItem() { throw new Error('vedado'); }, setItem() { throw new Error('vedado'); } };
    try {
      assert.equal(app.qaDobraAberta('concluido'), false);
      assert.equal(app.qaDobrar('concluido'), true);
      assert.equal(app.qaDobraAberta('concluido'), true, 'fica em memória');
      assert.equal(estados(app.qaHtmlLista()).concluido, true);
    } finally {
      app.localStorage = real;
    }
  });

  test('a folha recolhe pela altura num nó vivo, tira as linhas do Tab só no fim, e o hover só com rato', () => {
    const css = seccaoQa();
    assert.ok(css.includes('.qa-dobra-corpo{display:grid;grid-template-rows:1fr;transition:grid-template-rows var(--medio) var(--curva-entra)}'));
    assert.ok(css.includes('.qa-dobra.fechada>.qa-dobra-corpo{grid-template-rows:0fr;'));
    assert.ok(css.includes('.qa-dobra.fechada>.qa-dobra-corpo>.qa-dobra-itens{visibility:hidden;transition:visibility 0s var(--medio)}'));
    assert.match(css, /\.qa-dobra-cab\{[^}]*min-height:44px/, 'o alvo do dedo');
    assert.ok(css.includes('@media(hover:hover) and (pointer:fine){.qa-dobra-cab:hover{'));
    assert.doesNotMatch(css.replace(/@media\(hover:hover\)[^{]*\{[^{}]*\{[^}]*\}\}/g, ''), /:hover/, 'nenhum :hover fora do portão');
  });
});

describe('a pega do lado da borda', () => {
  test('a pega vira-se para a borda: à direita vai para o fim, com o enchimento curto do lado dela', () => {
    const css = seccaoQa();
    assert.ok(css.includes('.qa-pilula[data-lado="dir"] .qa-pega{order:1}'), 'à direita, a pega depois do número');
    assert.ok(css.includes('.qa-pilula[data-lado="dir"] .qa-botao{padding:0 6px 0 12px}'), 'e o enchimento espelhado');
    assert.match(css, /\.qa-botao\{[^}]*padding:0 12px 0 6px/, 'à esquerda, como nasceu');
    assert.ok(app.qaHtmlPilula(1, false).indexOf('qa-pega') < app.qaHtmlPilula(1, false).indexOf('qa-ic'),
      'no HTML a pega vem primeiro (a ordem de leitura não muda; é a folha que a leva)');
  });

  test('o lado só muda ao largar: a meio do arrasto, do outro lado do ecrã, a pega fica onde estava', () => {
    apiFalsa();
    noDev();
    app.qaSincronizar();
    const lados = [];
    app.qaPil.setAttribute = (k, v) => { if (k === 'data-lado') lados.push(v); };
    app.qaReencaixar();
    igual(lados, ['dir'], 'nasce à direita');
    app.qaPousar(ponteiro(1100, 700, { type: 'pointerdown' }));
    app.qaArrastoMove(ponteiro(600, 600));
    app.qaArrastoMove(ponteiro(100, 500));
    igual(lados, ['dir'], 'atravessou o meio a arrastar e o lado não mudou');
    app.qaArrastoFim(ponteiro(100, 500, { type: 'pointerup' }));
    igual(lados, ['dir', 'esq'], 'ao largar à esquerda, a pega passa para a esquerda');
    app.qaTecla({ key: 'ArrowRight', preventDefault() {} });
    igual(lados, ['dir', 'esq', 'dir'], 'e as setas também a trocam');
  });
});

describe('o HTML gerado', () => {
  test('sem style= nem on…=, em todos os pedaços; o texto de quem escreve vai escapado', () => {
    const t = T('X1', { body: 'Linha 1\nLinha 2', severity: 'detalhe', imagem: true, status: 'human-tests', cartao: 'KAN-3', resolution: 'Feito', resolved_at: 9,
      context: { ecra: { tab: 'calendar' }, rasto: ['GET /api/state → 200'] } });
    const pedacos = [app.qaHtmlPilula(3, true), app.qaHtmlNovo({ ecra: {} }), app.qaHtmlImagem('blob:x'), app.qaHtmlImagem('a-preparar'),
      app.qaHtmlTicket(t), app.qaRodapeTicket(t), app.qaHtmlLinha(t)];
    app.qaLista.tickets = [t, T('X2')];
    pedacos.push(app.qaHtmlLista());
    pedacos.forEach((h, i) => assert.doesNotMatch(h, SEM_EM_LINHA, 'pedaço ' + i));
    const mau = T('<x>', { body: '<img src=x onerror=alert(1)>', autor: { nome: '<script>' } });
    const h = app.qaHtmlLinha(mau) + app.qaHtmlTicket(mau);
    assert.doesNotMatch(h, /<img src=x|<script>/, 'nada do que alguém escreveu vira HTML');
    assert.match(h, /qaAbrirTicket\('&lt;x&gt;'\)/, 'o id também escapado');
    assert.match(app.qaHtmlPilula(150, false), />99\+</, 'o número fica curto');
  });
});

describe('o ticket sobrevive à conta e a pílula às janelas', () => {
  test('uma conta apagada (anonimizada ou que já nem existe) aparece como «Conta apagada»', () => {
    assert.equal(app.qaAutor(T('A1', { autor: { id: 'z', nome: '[deleted]', email: 'apagado-z@invalido.local' } })), 'Conta apagada');
    assert.equal(app.qaAutor(T('A2', { autor: { id: 'z', nome: '', email: '' } })), 'Conta apagada');
    assert.equal(app.qaAutor(T('A3', { autor: { id: 'q', nome: 'Rui Abreu', email: 'rui@rendorium.test' } }), true), 'Rui Abreu · rui@rendorium.test');
  });

  test('o ticket de uma conta de teste é da conta do Discord que pediu o /test, mesmo depois de ela sair', () => {
    const d = { id: 'tst1', nome: 'Conta de teste', email: 'teste-tst1@teste.rendorium.com', discord: { id: '4242', nome: 'Martinho' } };
    assert.equal(app.qaAutor(T('D1', { autor: d })), 'Martinho (Discord)');
    assert.equal(app.qaAutor(T('D2', { autor: d }), true), 'Martinho (Discord) · 4242');
    assert.equal(app.qaAutor(T('D3', { autor: { id: 'z', nome: '', email: '', discord: { id: '4242', nome: '' } } })), 'Discord 4242',
      'a conta de teste já saiu e a ligação não trouxe o nome: fica o id do Discord');
    noDev();
    app.CW.user = { id: 'tst1' };
    assert.equal(app.qaAutor(T('D4', { autor: d })), 'Martinho (Discord) (eu)');
  });

  test('as janelas do QA levam a marca .qa-janela, e a folha põe a pílula acima das outras janelas e abaixo das do QA', () => {
    const el = { classList: { lista: [], add(c) { this.lista.push(c); } } };
    app.qaMarcarJanela({ el });
    app.qaMarcarJanela(null);
    assert.deepEqual(el.classList.lista, ['qa-janela']);
    const css = lerFolha();
    const acima = css.indexOf('body:has(.modal.open) .qa-pilula{z-index:71}');
    const abaixo = css.indexOf('body:has(.modal.open.qa-janela) .qa-pilula{z-index:60}');
    assert.ok(acima > -1 && abaixo > acima, 'a regra das janelas do QA vem depois e ganha');
  });
});

/* A folha de estilos inteira, com os fins de linha normalizados.
   Devolve: o texto do web/estilos.css. */
function lerFolha() {
  return readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

/* O bloco do QA na folha de estilos, entre os dois marcadores.
   Devolve: o texto do bloco. */
function seccaoQa() {
  const css = lerFolha();
  const ini = css.indexOf('/* === tickets de QA:'), fim = css.indexOf('/* === fim: tickets de QA === */');
  assert.ok(ini > -1 && fim > ini, 'os marcadores do bloco do QA');
  return css.slice(ini, fim);
}

/* A base da app (o db do contexto).
   Devolve: o objeto db. */
function db() {
  return app.db;
}
