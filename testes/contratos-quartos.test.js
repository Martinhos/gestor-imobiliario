// O contrato num imóvel arrendado por quartos, o contacto do senhorio e as
// horas da visita. O que se prova: sem quartos arrendados o formulário é o de
// sempre (o «Imóvel inteiro» à cabeça e escolhido); com algum quarto
// arrendado (um contrato que ainda não acabou), o «Imóvel inteiro» sai, os
// arrendados não se escolhem e o contrato novo abre no primeiro quarto livre;
// sem quartos livres o formulário diz que não há contrato possível; o guardar
// recusa a casa inteira, junto do campo; um contrato antigo da casa inteira
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
   Recebe: quartos — {id do quarto ou null: 'vivo'|'futuro'|'terminado'}.
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
    roomId: q === 'null' ? null : q, tenantIds: ['I1'], rent: 300 }, datas[e])));
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
    assert.match(html, /Já há quartos arrendados: o contrato é de um dos quartos livres, e não do imóvel inteiro\./);
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
    assert.match(html, /role="radiogroup" aria-labelledby="c_roomRot" aria-describedby="c_roomSem">/);
    assert.match(html, /<div class="hint" id="c_roomSem">Todos os quartos deste imóvel estão arrendados, por isso não há contrato novo possível aqui\./);
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
    assert.deepEqual(vistos, [['c_roomEsc', 'Já há quartos arrendados: escolhe um dos quartos livres.']]);
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
    assert.doesNotMatch(html, /Já há quartos arrendados/);
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

  test('o início e o fim da visita vão lado a lado num .vis-par, e nenhuma regra os empilha no telemóvel', () => {
    base();
    app.visForm = app.normVisit({ propertyId: 'P1', date: '2026-10-20', start: '14:30', end: '15:00' });
    const html = app.visBody();
    assert.match(html, /<div class="vis-par">\s*<label>Início<input id="vi_start" type="time" value="14:30"><\/label>\s*<label>Fim<input id="vi_end" type="time" value="15:00"><\/label><\/div>/);
    assert.match(regra('.vis-par'), /grid-template-columns:repeat\(2,minmax\(0,8\.75rem\)\)/, 'duas colunas da largura da hora');
    assert.match(regra('.vis-par'), /justify-content:start/, 'encostadas à esquerda, sem esticar');
    assert.doesNotMatch(CSS, /@media[^{]*\{[^}]*\.vis-par\{[^}]*grid-template-columns:1fr/, 'nenhuma largura as põe uma por linha');
    assert.match(html, /<label>Quarto<div class="sel"/, 'o resto do formulário fica');
  });
});
