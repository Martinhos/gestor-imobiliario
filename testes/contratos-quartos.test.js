// O contrato num imóvel arrendado por quartos, o contacto do senhorio e as
// horas da visita. O que se prova: sem quartos arrendados o formulário é o de
// sempre (o «Imóvel inteiro» à cabeça e escolhido); com quartos arrendados (um
// contrato que ainda não acabou) as escolhas dependem do INÍCIO do contrato
// novo — a casa inteira a partir do dia do último fim dos contratos dos
// quartos, um quarto arrendado a partir do dia do fim do dele, e um contrato
// sem data de fim bloqueia; as datas dizem-se em dd/mm/aaaa no chip e na
// frase; mudar o início reavalia sem largar a escolha, com o erro junto dos
// chips; o contrato novo abre no primeiro quarto livre, ou, sem livres, no
// que fica livre primeiro, com o início nesse dia; o guardar recusa uma
// escolha que não vale para o início; um contrato antigo da casa inteira
// continua a editar-se; o contacto escolhido parte linhas em vez de sair da
// caixa; e o início e o fim da visita vão lado a lado, também no telemóvel.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarApp();
afterEach(() => repor(app));

const CSS = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
const ANO = new Date().getFullYear();

/* Um imóvel por quartos (Quarto 1 a 4), uma proprietária e uma inquilina; os
   contratos que se pedirem, cada um num quarto (null: o imóvel inteiro).
   Recebe: quartos — {id do quarto ou null: 'vivo'|'futuro'|'terminado', ou as
   datas {start, end} do contrato}; 'vivo' e 'futuro' não têm data de fim.
   Devolve: as janelas abertas (janelasFalsas). */
function base(quartos) {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Eu' })];
  app.db.tenants = [app.normPerson({ id: 'I1', name: 'Ana' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'Casa dos quartos', use: 'investimento', rentalMode: 'quartos', ownerIds: ['O1'],
    rooms: [1, 2, 3, 4].map((n) => ({ id: 'Q' + n, name: 'Quarto ' + n })) }),
  app.normProp({ id: 'P2', name: 'T1 Porto', use: 'investimento', ownerIds: ['O1'] })];
  const datas = { vivo: { start: (ANO - 1) + '-01-01' }, futuro: { start: (ANO + 2) + '-01-01' },
    terminado: { start: (ANO - 3) + '-01-01', end: (ANO - 2) + '-12-31' } };
  app.db.contracts = Object.entries(quartos || {}).map(([q, e], i) => app.normContract(Object.assign({ id: 'C' + (i + 1), propertyId: 'P1',
    roomId: q === 'null' ? null : q, tenantIds: ['I1'], rent: 300 }, typeof e === 'string' ? datas[e] : e)));
  return janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
}

/* Os chips do quarto no HTML do formulário: [rótulo, escolhido, «já arrendado», desligado].
   Recebe: html — o corpo do formulário.
   Devolve: a lista dos chips, pela ordem. */
const chips = (html) => [...html.matchAll(/role="radio" aria-checked="(true|false)" data-v="([^"]*)"([^>]*)>([^<]+)(<span class="ct-ja-txt"> · já arrendado<\/span>)?/g)]
  .map((m) => [m[4], m[1] === 'true', !!m[5], / disabled/.test(m[3])]);

/* As regras de um seletor exato na folha de estilos, juntas.
   Recebe: sel — o seletor, como está escrito.
   Devolve: o texto das declarações (todas as regras com ele). */
const regra = (sel) => [...CSS.matchAll(/(^|[}\n])([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => m[2].split(',').map((s) => s.trim()).includes(sel)).map((m) => m[3]).join(';');

describe('o contrato num imóvel por quartos', () => {
  test('sem quartos arrendados, tudo como dantes: o «Imóvel inteiro» à cabeça e escolhido', () => {
    const abertas = base({ Q1: 'terminado' });
    app.ctModal(null, 'P1');
    const html = abertas[0].b;
    assert.equal(app.cForm.roomId, null);
    assert.match(html, /<input type="hidden" id="c_room" value="">/);
    assert.deepEqual(chips(html), [['Imóvel inteiro', true, false, false], ['Quarto 1', false, false, false],
      ['Quarto 2', false, false, false], ['Quarto 3', false, false, false], ['Quarto 4', false, false, false]],
    'um contrato terminado não ocupa o quarto');
    assert.doesNotMatch(html, /Já há quartos arrendados|c_roomSem/);
    assert.match(html, /<span class="flabel" id="c_roomRot">Quarto<\/span>/, 'sem asterisco: o imóvel inteiro também é escolha');
  });

  test('com um quarto arrendado: sem «Imóvel inteiro», o arrendado desligado e o primeiro livre escolhido', () => {
    const abertas = base({ Q1: 'vivo' });
    app.ctModal(null, 'P1');
    const html = abertas[0].b;
    assert.equal(app.cForm.roomId, 'Q2');
    assert.match(html, /<input type="hidden" id="c_room" value="Q2">/, 'o campo que o collectCt lê também');
    assert.deepEqual(chips(html), [['Quarto 1', false, true, true], ['Quarto 2', true, false, false],
      ['Quarto 3', false, false, false], ['Quarto 4', false, false, false]]);
    assert.doesNotMatch(html, /Imóvel inteiro/);
    assert.match(html, /data-v="Q1" disabled>/, 'o desligado não tem ação nenhuma');
    assert.match(html, /data-v="Q3" data-toca="rascunho" data-click="ctEscolheQuarto\('Q3'\)"/);
    assert.match(html, /Quarto <span class="req">\*<\/span>/, 'escolher um quarto passa a ser obrigatório');
    assert.match(html, /<div class="hint" id="c_roomFrase">A casa inteira não se escolhe enquanto houver um quarto arrendado sem data de fim\.<\/div>/, 'sem data de fim, a casa inteira fica bloqueada');
    assert.match(html, /role="radiogroup" aria-labelledby="c_roomRot" aria-describedby="c_roomFrase">/);
  });

  test('o primeiro livre segue a ordem da ficha, e um contrato que só começa daqui a anos já ocupa o quarto', () => {
    const abertas = base({ Q1: 'futuro', Q2: 'terminado', Q3: 'vivo' });
    app.ctModal(null, 'P1');
    assert.equal(app.cForm.roomId, 'Q2');
    assert.deepEqual(chips(abertas[0].b).map((c) => [c[0], c[3]]), [['Quarto 1', true], ['Quarto 2', false], ['Quarto 3', true], ['Quarto 4', false]]);
    assert.equal(app.ctQuartoPorOmissao({ propertyId: 'P2' }), null, 'num imóvel inteiro não há quarto');
  });

  test('sem quartos livres não há escolha: a frase diz porquê, e o grupo aponta-lhe', () => {
    const abertas = base({ Q1: 'vivo', Q2: 'vivo', Q3: 'futuro', Q4: 'vivo' });
    app.ctModal(null, 'P1');
    const html = abertas[0].b;
    assert.equal(app.cForm.roomId, null);
    assert.ok(chips(html).every((c) => c[3] && !c[1]), 'todos desligados, nenhum escolhido');
    assert.match(html, /role="radiogroup" aria-labelledby="c_roomRot" aria-describedby="c_roomFrase">/);
    assert.match(html, /<div class="hint" id="c_roomFrase">Todos os quartos deste imóvel estão arrendados sem data de fim, por isso não há contrato novo possível aqui\./);
    assert.equal(app.cForm.start, app.today(), 'sem nenhum fim à vista, o início fica o de hoje');
  });

  test('o guardar recusa a casa inteira com quartos arrendados, junto dos chips; com um quarto livre grava', () => {
    base({ Q1: 'vivo' });
    app.ctModal(null, 'P1', 'I1');
    const vistos = [];
    let gravou = 0;
    app.falhaCampo = (id, msg) => { vistos.push([id, msg]); };
    app.ctGravar = () => { gravou++; };
    const el = (id) => app.document.getElementById(id);
    el('c_prop').value = 'P1';
    el('c_rent').value = '400';
    el('c_room').value = '';
    app.onSave();
    assert.deepEqual(vistos, [['c_roomEsc', 'A casa inteira não se escolhe enquanto houver um quarto arrendado sem data de fim: escolhe um quarto.']]);
    assert.equal(gravou, 0);
    el('c_room').value = 'Q4';
    app.onSave();
    assert.equal(gravou, 1);
    assert.equal(app.cForm.roomId, 'Q4');
  });

  test('sem quartos livres, o guardar repete o porquê e nada se grava', () => {
    base({ Q1: 'vivo', Q2: 'vivo', Q3: 'vivo', Q4: 'vivo' });
    app.ctModal(null, 'P1');
    const vistos = [];
    let gravou = 0;
    app.falhaCampo = (id, msg) => { vistos.push([id, msg]); };
    app.ctGravar = () => { gravou++; };
    const el = (id) => app.document.getElementById(id);
    el('c_prop').value = 'P1';
    el('c_rent').value = '400';
    app.onSave();
    assert.deepEqual(vistos, [['c_roomEsc', 'Todos os quartos deste imóvel estão arrendados: não há contrato novo possível aqui.']]);
    assert.equal(gravou, 0);
  });

  test('um contrato gravado da casa inteira continua a abrir e a gravar como estava', () => {
    const abertas = base({ null: 'vivo', Q2: 'vivo' });
    app.ctModal('C1');
    const html = abertas[0].b;
    assert.deepEqual(chips(html)[0], ['Imóvel inteiro', true, false, false]);
    assert.equal(app.ctInteiroGravado(app.cForm), true);
    assert.equal(app.ctInteiroPossivel(app.cForm), true);
    let gravou = 0;
    app.falhaCampo = () => { throw new Error('não devia recusar'); };
    app.ctGravar = () => { gravou++; };
    const el = (id) => app.document.getElementById(id);
    el('c_prop').value = 'P1';
    el('c_rent').value = '900';
    app.onSave();
    assert.equal(gravou, 1);
  });

  test('editar o contrato de um quarto: o quarto dele escolhido, mesmo com outro contrato no mesmo quarto; sem a frase do contrato novo', () => {
    const abertas = base({ Q1: 'vivo', Q3: 'futuro', Q4: 'futuro' });
    app.db.contracts.push(app.normContract({ id: 'C9', propertyId: 'P1', roomId: 'Q3', tenantIds: ['I1'], rent: 300, start: (ANO - 1) + '-01-01' }));
    app.ctModal('C9');
    const html = abertas[0].b;
    assert.equal(app.cForm.roomId, 'Q3');
    assert.deepEqual(chips(html), [['Quarto 1', false, true, true], ['Quarto 2', false, false, false], ['Quarto 3', true, true, false], ['Quarto 4', false, true, true]]);
    assert.doesNotMatch(html, /c_roomEsc-erro/, 'o quarto dele vale sempre, sem erro');
  });

  test('trocar de imóvel escolhe o quarto do imóvel novo como um contrato novo o escolheria', () => {
    base({ Q1: 'vivo', Q2: 'vivo' });
    app.ctModal(null, 'P2');
    assert.equal(app.cForm.roomId, null);
    app.repaintCt = () => {};
    app.document.getElementById('c_prop').value = 'P1';
    app.onCtProp();
    assert.equal(app.cForm.roomId, 'Q3');
    app.document.getElementById('c_prop').value = 'P2';
    app.onCtProp();
    assert.equal(app.cForm.roomId, null);
  });

  test('o «Novo contrato» de um quarto livre abre nesse quarto, e não no primeiro livre', () => {
    const abertas = base({ Q1: 'vivo' });
    app.contratoNoQuarto('P1', 'Q4');
    assert.equal(abertas.length, 1);
    assert.equal(app.cForm.roomId, 'Q4');
    assert.equal(app.document.getElementById('c_room').value, 'Q4');
  });

  test('tocar num quarto larga o erro do guardar', () => {
    base({ Q1: 'vivo' });
    const tirados = [], fora = [];
    const grupo = { classList: { remove: (c) => tirados.push(c) }, querySelectorAll: () => [],
      getAttribute: (a) => (a === 'aria-describedby' ? 'c_roomEsc-erro' : null), removeAttribute: (a) => tirados.push(a) };
    app.document.querySelector = (s) => (s === '.ct-quartos' ? grupo : null);
    app.document.getElementById('c_roomEsc-erro').remove = () => fora.push('erro');
    app.ctEscolheQuarto('Q2');
    assert.equal(app.document.getElementById('c_room').value, 'Q2');
    assert.deepEqual(tirados, ['err', 'aria-invalid', 'aria-describedby']);
    assert.deepEqual(fora, ['erro']);
  });
});

/* As datas das provas das datas: o fim de um contrato (A), o de outro mais
   longo (B), e a véspera de cada um — todas no ano que vem, para os
   contratos estarem vivos hoje. */
const A = (ANO + 1) + '-03-31', VA = (ANO + 1) + '-03-30';
const B = (ANO + 1) + '-08-31', VB = (ANO + 1) + '-08-30';
const pt = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
const ate = (fim) => ({ start: (ANO - 1) + '-01-01', end: fim });

/* Os chips do quarto com o que dizem ao lado do nome: [rótulo, escolhido,
   a marca («· livre a …», «· já arrendado» ou ''), desligado].
   Recebe: html — o corpo do formulário ou o miolo do campo.
   Devolve: a lista dos chips, pela ordem. */
const chipsDatas = (html) => [...html.matchAll(/role="radio" aria-checked="(true|false)" data-v="([^"]*)"([^>]*)>([^<]+)(?:<span class="ct-ja-txt">([^<]*)<\/span>)?/g)]
  .map((m) => [m[4], m[1] === 'true', m[5] || '', / disabled/.test(m[3])]);

/* A frase por baixo dos chips.
   Recebe: html — o corpo do formulário ou o miolo do campo.
   Devolve: o texto, ou '' sem frase. */
/* Os chips à espera de uma data: não são disabled, mas dizem-no ao leitor
   de ecrã (aria-disabled) e tocam-se para começar nessa data.
   Recebe: html — o corpo do formulário ou o miolo do campo.
   Devolve: [rótulo, o aria-label, a ação] de cada um, pela ordem. */
const emEspera = (html) => [...html.matchAll(/class="chip[^"]* ct-espera" role="radio" aria-checked="false" data-v="([^"]*)" aria-label="([^"]*)" aria-disabled="true" data-toca="rascunho" data-click="([^"]*)">([^<]+)/g)]
  .map((m) => [m[4], m[2], m[3].replace(/&#39;/g, "'")]);

const frase = (html) => ((html.match(/<div class="hint" id="c_roomFrase">([^<]*)<\/div>/) || [])[1] || '');

describe('as datas do contrato num imóvel por quartos', () => {
  test('o estado dos quartos diz quando cada arrendado fica livre: o fim mais tarde do quarto, as renovações escritas à mão, e sem fim fica sem data', () => {
    base({ Q1: ate(A), Q2: ate(A), Q3: 'vivo' });
    app.db.contracts.push(app.normContract({ id: 'C8', propertyId: 'P1', roomId: 'Q1', tenantIds: ['I1'], rent: 300, start: (ANO + 1) + '-04-01', end: B }));
    app.db.contracts[1].fisco = app.normFisco(Object.assign({}, app.db.contracts[1].fisco, { renovacoes: [{ id: 'R1', inicio: (ANO + 1) + '-04-01', fim: (ANO + 2) + '-03-31' }] }));
    const q = app.ctQuartosEstado({ propertyId: 'P1' });
    assert.deepEqual([...q.ocupados], ['Q1', 'Q2', 'Q3']);
    assert.deepEqual([...q.livres], ['Q4']);
    assert.equal(q.fins.Q1, B, 'dois contratos no quarto: conta o que acaba mais tarde');
    assert.equal(q.fins.Q2, (ANO + 2) + '-03-31', 'a renovação escrita à mão estende o fim');
    assert.equal(q.fins.Q3, '', 'sem data de fim');
    assert.deepEqual([...q.semFim], ['Q3']);
    assert.equal(q.ultimoFim, '', 'um arrendado sem fim: a casa inteira não tem data');
    app.db.contracts = app.db.contracts.filter((c) => c.roomId !== 'Q3');
    assert.equal(app.ctQuartosEstado({ propertyId: 'P1' }).ultimoFim, (ANO + 2) + '-03-31', 'sem ele, o fim mais tarde de todos');
  });

  test('a casa inteira escolhe-se com o início no dia do último fim, ou depois; na véspera não', () => {
    base({ Q1: ate(A), Q2: ate(B) });
    const c = (start) => ({ propertyId: 'P1', start });
    assert.equal(app.ctInteiroPossivel(c(VB)), false, 'na véspera do fim do contrato mais longo');
    assert.equal(app.ctInteiroPossivel(c(B)), true, 'no próprio dia do fim');
    assert.equal(app.ctInteiroPossivel(c((ANO + 3) + '-01-01')), true, 'depois');
    assert.equal(app.ctInteiroPossivel(c(A)), false, 'o fim do mais curto não chega');
    assert.equal(app.ctInteiroPossivel(c('')), false, 'sem início, conta o dia de hoje');
  });

  test('um quarto arrendado escolhe-se com o início no dia do fim do contrato dele, ou depois; um livre sempre', () => {
    base({ Q1: ate(A), Q2: ate(B) });
    const c = (start) => ({ propertyId: 'P1', start });
    assert.equal(app.ctQuartoPossivel(c(VA), null, 'Q1'), false);
    assert.equal(app.ctQuartoPossivel(c(A), null, 'Q1'), true, 'no dia do fim');
    assert.equal(app.ctQuartoPossivel(c(A), null, 'Q2'), false, 'o Q2 acaba mais tarde');
    assert.equal(app.ctQuartoPossivel(c(B), null, 'Q2'), true);
    assert.equal(app.ctQuartoPossivel(c(VA), null, 'Q3'), true, 'livre');
  });

  test('um contrato sem data de fim bloqueia a casa inteira e o quarto dele, por mais tarde que seja o início', () => {
    const abertas = base({ Q1: ate(A), Q2: 'vivo' });
    const longe = { propertyId: 'P1', start: (ANO + 30) + '-01-01' };
    assert.equal(app.ctInteiroPossivel(longe), false);
    assert.equal(app.ctQuartoPossivel(longe, null, 'Q2'), false);
    assert.equal(app.ctQuartoPossivel(longe, null, 'Q1'), true);
    app.ctModal(null, 'P1');
    const ch = chipsDatas(abertas[0].b);
    assert.ok(!ch.some((x) => x[0] === 'Imóvel inteiro'), 'a casa inteira nem aparece: nenhuma data a deixa escolher');
    assert.deepEqual(ch.find((x) => x[0] === 'Quarto 2'), ['Quarto 2', false, ' · já arrendado', true]);
    assert.deepEqual(emEspera(abertas[0].b).map((x) => x[0]), ['Quarto 1'], 'o que tem fim espera pela data; o sem fim fica desligado de vez');
    assert.equal(frase(abertas[0].b), 'A casa inteira não se escolhe enquanto houver um quarto arrendado sem data de fim. Um quarto arrendado escolhe-se com o início no dia em que o contrato dele acaba, ou depois. Tocar numa escolha com data muda o início do contrato para esse dia.');
  });

  test('com quartos livres, o contrato novo abre no primeiro livre; a casa inteira e os arrendados esperam pela data, que dizem ao lado e ao leitor de ecrã, e a frase diz a da casa inteira', () => {
    const abertas = base({ Q1: ate(A), Q2: ate(B) });
    app.ctModal(null, 'P1');
    const html = abertas[0].b;
    assert.equal(app.cForm.roomId, 'Q3');
    assert.equal(app.cForm.start, app.today(), 'o início fica o de hoje');
    assert.deepEqual(chipsDatas(html), [['Imóvel inteiro', false, ' · livre a ' + pt(B), false], ['Quarto 1', false, ' · livre a ' + pt(A), false],
      ['Quarto 2', false, ' · livre a ' + pt(B), false], ['Quarto 3', true, '', false], ['Quarto 4', false, '', false]], 'nenhum disabled: o toque tem de chegar');
    assert.deepEqual(emEspera(html), [
      ['Imóvel inteiro', 'Imóvel inteiro, livre a ' + pt(B) + ', toca para começar nessa data', "ctComecaNoFim('')"],
      ['Quarto 1', 'Quarto 1, livre a ' + pt(A) + ', toca para começar nessa data', "ctComecaNoFim('Q1')"],
      ['Quarto 2', 'Quarto 2, livre a ' + pt(B) + ', toca para começar nessa data', "ctComecaNoFim('Q2')"]]);
    assert.equal(frase(html), 'A casa inteira só a partir de ' + pt(B) + ', o fim do contrato mais longo. Um quarto arrendado escolhe-se com o início no dia em que o contrato dele acaba, ou depois. Tocar numa escolha com data muda o início do contrato para esse dia.');
    assert.doesNotMatch(frase(html) + chipsDatas(html).map((x) => x[2]).join(''), /\d{4}-\d{2}-\d{2}/, 'nenhuma data ISO no que se lê');
    const outra = base({ Q1: ate(A) });
    app.ctModal(null, 'P1');
    assert.match(frase(outra[0].b), new RegExp('^A casa inteira só a partir de ' + pt(A) + ', o fim do contrato do quarto arrendado\\.'));
  });

  test('sem quartos livres, o contrato novo abre no primeiro quarto da lista com data de fim, com o início nesse dia — mesmo que outro vague antes', () => {
    let abertas = base({ Q1: ate(B), Q2: ate(A), Q3: ate(A), Q4: ate(A) });
    app.ctModal(null, 'P1');
    assert.deepEqual([app.cForm.roomId, app.cForm.start], ['Q1', B], 'o primeiro da ficha, e não o que vaga primeiro');
    assert.match(abertas[0].b, /<input id="c_start" type="date" value="[^"]*" data-change="ctInicioMudou\(\)">/, 'o campo do início reavalia as escolhas');
    assert.match(abertas[0].b, new RegExp('<input id="c_start" type="date" value="' + B + '"'), 'o início nesse dia');
    abertas = base({ Q1: 'vivo', Q2: ate(B), Q3: ate(A), Q4: 'vivo' });
    app.ctModal(null, 'P1');
    assert.deepEqual([app.cForm.roomId, app.cForm.start], ['Q2', B], 'o primeiro sem fim passa ao seguinte que tenha');
    const html = abertas[0].b;
    assert.deepEqual(chipsDatas(html).map((x) => [x[0], x[1], x[3]]), [['Quarto 1', false, true], ['Quarto 2', true, false], ['Quarto 3', false, false], ['Quarto 4', false, true]]);
    assert.doesNotMatch(html, /c_roomEsc-erro/);
    assert.deepEqual({ ...app.ctOmissaoSemLivres({ propertyId: 'P1' }, app.ctQuartosEstado({ propertyId: 'P1' })) }, { roomId: 'Q2', start: B });
  });

  test('tocar num chip à espera escolhe-o e põe o início nessa data, pelo caminho do início mudado, com o aviso; um sem fim não muda nada', () => {
    base({ Q1: ate(A), Q2: ate(B), Q3: 'vivo' });
    app.ctModal(null, 'P1');
    const el = (id) => app.document.getElementById(id);
    const ditos = [];
    app.toast = (m) => ditos.push(m);
    el('c_start').value = app.today();
    el('c_room').value = 'Q4';
    el('c_prazoFrase').textContent = '';
    app.ctComecaNoFim('Q1');
    assert.equal(el('c_start').value, A);
    assert.equal(el('c_room').value, 'Q1');
    assert.match(el('c_prazoFrase').textContent, /^Sem data de fim/, 'o liveNet correu: a frase do prazo refez-se');
    let miolo = el('c_roomCampo').innerHTML;
    assert.deepEqual(chipsDatas(miolo).find((x) => x[0] === 'Quarto 1'), ['Quarto 1', true, ' · livre a ' + pt(A), false]);
    assert.doesNotMatch(miolo, /c_roomEsc-erro/);
    assert.deepEqual(ditos, ['O início do contrato passou para ' + pt(A) + '.']);
    app.ctComecaNoFim('Q3');
    assert.equal(el('c_start').value, A, 'sem data de fim, nada muda');
    assert.equal(ditos.length, 1);
    // a casa inteira: tirado o contrato sem fim, espera pelo último fim
    app.db.contracts = app.db.contracts.filter((c) => c.roomId !== 'Q3');
    app.ctComecaNoFim('');
    assert.deepEqual([el('c_start').value, el('c_room').value], [B, '']);
    miolo = el('c_roomCampo').innerHTML;
    assert.deepEqual(chipsDatas(miolo)[0], ['Imóvel inteiro', true, ' · livre a ' + pt(B), false]);
    assert.equal(emEspera(miolo).length, 0, 'no último fim já nada espera');
    assert.equal(ditos[1], 'O início do contrato passou para ' + pt(B) + '.');
  });

  test('mudar o início reavalia: a escolha fica, o erro aparece junto dos chips e diz-se uma vez; volta a valer e o erro sai', () => {
    base({ Q1: ate(A) });
    app.ctModal(null, 'P1');
    const el = (id) => app.document.getElementById(id);
    const ditos = [];
    app.toast = (m) => ditos.push(m);
    el('c_room').value = 'Q1';
    el('c_start').value = A;
    app.ctInicioMudou();
    let miolo = el('c_roomCampo').innerHTML;
    assert.deepEqual(chipsDatas(miolo).slice(0, 2), [['Imóvel inteiro', false, ' · livre a ' + pt(A), false], ['Quarto 1', true, ' · livre a ' + pt(A), false]], 'no dia do fim, os dois escolhem-se');
    assert.doesNotMatch(miolo, /c_roomEsc-erro/);
    el('c_start').value = VA;
    app.ctInicioMudou();
    miolo = el('c_roomCampo').innerHTML;
    assert.deepEqual(chipsDatas(miolo)[1], ['Quarto 1', true, ' · livre a ' + pt(A), false], 'a escolha não se perde nem se desliga');
    assert.match(miolo, /<div class="chips-fila ct-quartos err" id="c_roomEsc" role="radiogroup" aria-labelledby="c_roomRot" aria-describedby="c_roomEsc-erro" aria-invalid="true">/);
    const erro = 'Com este início, o quarto escolhido ainda está arrendado: só a partir de ' + pt(A) + '.';
    assert.match(miolo, new RegExp('<p class="erro-campo" id="c_roomEsc-erro">' + erro.replace(/[.()/]/g, '\\$&') + '</p>'));
    assert.deepEqual(ditos, [erro]);
    app.ctInicioMudou();
    assert.deepEqual(ditos, [erro], 'o mesmo erro não se repete');
    el('c_start').value = (ANO + 2) + '-01-01';
    app.ctInicioMudou();
    assert.doesNotMatch(el('c_roomCampo').innerHTML, /c_roomEsc-erro|aria-invalid/);
    // a casa inteira escolhida e o início a recuar: fica escolhida, com o erro dela
    el('c_room').value = '';
    el('c_start').value = VA;
    app.ctInicioMudou();
    miolo = el('c_roomCampo').innerHTML;
    assert.deepEqual(chipsDatas(miolo)[0], ['Imóvel inteiro', true, ' · livre a ' + pt(A), false]);
    assert.match(miolo, new RegExp('Com este início, a casa inteira ainda não está livre: só a partir de ' + pt(A).replace(/\//g, '\\/') + '\\.'));
    assert.match(miolo, /Quarto <span class="req">\*<\/span>/);
  });

  test('o guardar recusa a escolha que não vale para o início, junto dos chips; no dia do fim grava', () => {
    base({ Q1: ate(A), Q2: ate(B) });
    app.ctModal(null, 'P1', 'I1');
    const vistos = [];
    let gravou = 0;
    app.falhaCampo = (id, msg) => { vistos.push([id, msg]); };
    app.ctGravar = () => { gravou++; };
    const el = (id) => app.document.getElementById(id);
    el('c_prop').value = 'P1';
    el('c_rent').value = '400';
    el('c_room').value = 'Q1';
    el('c_start').value = VA;
    app.onSave();
    el('c_room').value = '';
    el('c_start').value = A;
    app.onSave();
    assert.deepEqual(vistos, [['c_roomEsc', 'Com este início, o quarto escolhido ainda está arrendado: só a partir de ' + pt(A) + '.'],
      ['c_roomEsc', 'Com este início, a casa inteira ainda não está livre: só a partir de ' + pt(B) + '.']]);
    assert.equal(gravou, 0);
    el('c_room').value = 'Q1';
    app.onSave();
    assert.equal(gravou, 1, 'o Q1 no dia do fim do contrato dele');
    el('c_room').value = '';
    el('c_start').value = B;
    app.onSave();
    assert.equal(gravou, 2, 'a casa inteira no dia do último fim');
    assert.equal(app.cForm.roomId, null);
  });

  test('editar: o quarto gravado do contrato vale sempre, e trocar de imóvel não lhe mexe no início', () => {
    const abertas = base({ Q1: ate(B), Q2: ate(A), Q3: ate(A), Q4: ate(A) });
    app.db.contracts.push(app.normContract({ id: 'C9', propertyId: 'P1', roomId: 'Q1', tenantIds: ['I1'], rent: 300, start: (ANO - 1) + '-06-01' }));
    app.ctModal('C9');
    assert.equal(app.ctEscolhaInvalida(app.cForm), '');
    assert.deepEqual(chipsDatas(abertas[0].b).find((x) => x[0] === 'Quarto 1'), ['Quarto 1', true, ' · livre a ' + pt(B), false]);
    app.db.contracts.push(app.normContract({ id: 'C7', propertyId: 'P2', tenantIds: ['I1'], rent: 300, start: (ANO - 1) + '-06-01' }));
    app.ctModal('C7');
    app.repaintCt = () => {};
    app.document.getElementById('c_start').value = (ANO - 1) + '-06-01';
    app.document.getElementById('c_prop').value = 'P1';
    app.onCtProp();
    assert.equal(app.cForm.start, (ANO - 1) + '-06-01', 'o início de um contrato gravado não se mexe');
    assert.equal(app.cForm.roomId, null, 'e nada se escolhe por ele');
  });
});

describe('o contacto do senhorio e as horas da visita', () => {
  test('o contacto escolhido vem em bocados: o telefone inteiro, o email a partir onde for preciso, tudo escapado', () => {
    const abertas = base();
    const longo = 'maria.joana.albuquerque.vasconcelos@imobiliaria-exemplo.pt';
    Object.assign(app.db.owners[0], { name: 'Maria <b>Joana</b>', email: longo, phone: '912345678' });
    app.ctModal(null, 'P2');
    const html = abertas[0].b;
    assert.match(html, /<div class="ct-net-linha ct-contacto-escolhido"><span>Maria &lt;b&gt;Joana&lt;\/b&gt;<\/span>/);
    assert.match(html, /<b><span class="ct-contacto-tel">[^<]*912[^<]*<\/span> · <span class="ct-contacto-mail">maria\.joana[^<]*\.pt<\/span><\/b>/);
    assert.equal(app.ctMeiosDeContacto({ phone: '', email: '' }), 'sem contacto na ficha');
    assert.equal(app.ctMeiosDeContacto({ phone: '', email: 'a@b.pt' }), '<span class="ct-contacto-mail">a@b.pt</span>');
  });

  test('a folha de estilos deixa o contacto partir linhas: sem nowrap no valor, e o nome e o email a partir em qualquer sítio', () => {
    assert.match(regra('.ct-net-linha.ct-contacto-escolhido'), /flex-wrap:wrap/);
    const valor = regra('.ct-net-linha.ct-contacto-escolhido>b');
    assert.match(valor, /white-space:normal/, 'ganha ao nowrap da linha da líquida');
    assert.match(valor, /overflow-wrap:anywhere/);
    assert.match(regra('.ct-contacto-escolhido>span'), /overflow-wrap:anywhere/);
    assert.match(regra('.ct-contacto-tel'), /white-space:nowrap/);
  });

  test('o início e o fim da visita vão lado a lado num .vis-par, em duas colunas iguais, e nenhuma regra os empilha no telemóvel', () => {
    base();
    app.visForm = app.normVisit({ propertyId: 'P1', date: '2026-10-20', start: '14:30', end: '15:00' });
    const html = app.visBody();
    assert.match(html, /<div class="vis-par">\s*<label>Início<input id="vi_start" type="time" value="14:30"><\/label>\s*<label>Fim<input id="vi_end" type="time" value="15:00"><\/label><\/div>/);
    assert.match(regra('.vis-par'), /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'duas colunas iguais, que enchem a linha');
    assert.doesNotMatch(regra('.vis-par'), /justify-content:start/, 'não ficam encostadas à esquerda');
    assert.doesNotMatch(CSS, /@media[^{]*\{[^}]*\.vis-par\{[^}]*grid-template-columns:1fr/, 'nenhuma largura as põe uma por linha');
    assert.match(html, /<label>Quarto<div class="sel"/, 'o resto do formulário fica');
  });
});
