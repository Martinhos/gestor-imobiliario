// A hipoteca mista preenchida pela FINE continua editável. Ticket de QA
// 8994d49a: com o indexante lido a 2,535, o Martinho diz que o valor se
// mantinha por mais que escrevesse outro na caixa «Indexante (%)». No browser
// (a 384×785, com toque, como no telemóvel dele) não se reproduziu: escrever
// muda a caixa, o l.euribor, a simulação e o que se grava. Aqui fica a prova
// do lado da app, com o formulário que o loanSect
// desenha posto no DOM do arnês e o collectProp a sério: escrever no indexante
// (com vírgula ou com ponto) muda o l.euribor e a caixa da simulação, a marca
// da FINE sai e não volta, e uma repintura depois de escrever mostra o valor
// escrito, e não o lido. Só uma leitura nova da FINE o substitui.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-03' });

/* A resposta da rota para a FINE do ticket fc2e9daa, como deve vir: os
   valores sem produtos, o indexante lido e um produto só com as duas reduções. */
const CAMPOS = { bank: 'Caixa Geral de Depósitos', outstanding: 150000, prazoMeses: 360, type: 'mista', rate: 4.8, fixedYears: 2, index: '3m', euribor: 2.535, spread: 1.5 };
const PRODUTOS = [{ tipo: 'conjunto', spread: 0.8, tan: 0.8 }];

/* O texto de um atributo de HTML de volta a texto (o inverso do esc()).
   Recebe: s — o texto escapado.
   Devolve: o texto. */
const desescapa = (s) => String(s).replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/* Põe no DOM do arnês os campos que o HTML desenha, com o valor (e o
   checked) de cada um — o que o browser faria ao pintar o formulário. O
   collectProp lê-os pelo id.
   Recebe: html — o HTML do formulário (o loanSect).
   Devolve: os ids dos campos postos. */
function porNoDom(html) {
  const ids = [];
  for (const m of html.matchAll(/<input ([^>]*)>/g)) {
    const a = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], desescapa(x[2])]));
    if (!a.id) continue;
    const el = app.document.getElementById(a.id);
    el.value = a.value || '';
    el.checked = /\schecked\b/.test(' ' + m[1]);
    ids.push(a.id);
  }
  return ids;
}

/* A casa p1 com uma hipoteca nova no formulário, como o newMort a deixa, e a
   FINE aplicada como o fineFicheiro a aplica (fine.js:fineAplicar); depois a
   repintura (o loanSect) posta no DOM.
   Devolve: a hipoteca (de pForm). */
function mistaDaFine() {
  const p = app.normProp({ id: 'p1', name: 'Casa', loans: [] });
  app.db.properties.push(p);
  app.pForm = app.normProp(JSON.parse(JSON.stringify(p)));
  const l = app.normLoan({ id: 'a', name: 'Aquisição' });
  app.pForm.loans.push(l);
  const n = app.fineAplicar(app.findLoan(app.pForm, 'a'), CAMPOS, app.fineDe('a'), [], PRODUTOS, null);
  assert.ok(n > 0, 'a FINE preencheu');
  porNoDom(app.loanSect(L(), 0));
  return L();
}
const L = () => app.findLoan(app.pForm, 'a');
/* A caixa da simulação como está no DOM.
   Devolve: o HTML do loanBox_a. */
const caixa = () => app.document.getElementById('loanBox_a').innerHTML;
/* A prestação depois da fase fixa, tal como a caixa a escreve.
   Recebe: h — o HTML da caixa.
   Devolve: o texto («Prestação a partir de …</span><b>… €»), ou ''. */
const depoisDaFixa = (h) => (h.match(/Prestação a partir de [^<]*<\/span><b>[^<]*/) || [''])[0];
/* Escreve na caixa do indexante e corre o que o data-input dela corre.
   Recebe: texto — o que fica escrito.
   Devolve: nada. */
const escrever = (texto) => { app.document.getElementById('l_eur_a').value = texto; app.liveLoan('a'); };

beforeEach(() => {
  limpar(app);
  app.render = () => {};
  app.toast = () => {};
  app.save = () => {};
  app.pode = () => true;
  app.CW = { ambiente: 'dev', user: { token: 't' } };
});
afterEach(() => repor(app));

describe('a mista lida da FINE', () => {
  test('o formulário mostra o indexante lido, com a marca, e os valores sem produtos', () => {
    const l = mistaDaFine();
    igual([l.type, l.rate, l.index, l.euribor, l.spread, l.fixedYears], ['mista', 4.8, '3m', 2.535, 1.5, 2]);
    igual(l.produtos.map((x) => [x.tipo, x.spread, x.tan, x.ativo]), [['conjunto', 0.8, 0.8, false]]);
    const h = app.loanSect(l, 0);
    assert.match(h, /<label class="fine-lido">Indexante \(%\)<input id="l_eur_a" type="text" inputmode="decimal" value="2,535"/);
    igual(app.document.getElementById('l_eur_a').value, '2,535');
  });
});

describe('escrever no indexante', () => {
  test('com vírgula: o l.euribor e a caixa da simulação mudam, e a marca sai', () => {
    mistaDaFine();
    app.liveLoan('a');
    const antes = depoisDaFixa(caixa());
    assert.ok(antes, 'a caixa diz a prestação depois da fase fixa');
    escrever('2,635');
    igual(L().euribor, 2.635);
    const depois = depoisDaFixa(caixa());
    assert.ok(depois && depois !== antes, `a prestação depois da fixa mudou (${antes} → ${depois})`);
    igual(app.fineMarca(L(), 'euribor'), '', 'a marca da FINE sai');
    igual(app.fineMarca(L(), 'spread'), ' class="fine-lido"', 'e a dos outros campos fica');
  });

  test('com ponto, e a apagar: o l.euribor segue a caixa, tecla a tecla', () => {
    mistaDaFine();
    const vistos = [];
    for (const t of ['2,53', '2,5', '2,', '2', '', '2.', '2.6', '2.63', '2.635']) { escrever(t); vistos.push(L().euribor); }
    igual(vistos, [2.53, 2.5, 2, 2, 0, 2, 2.6, 2.63, 2.635]);
  });

  test('uma repintura depois de escrever mostra o valor escrito, e não o lido (a marca não volta)', () => {
    mistaDaFine();
    escrever('2,635');
    app.collectProp();   // o que cada repintura do formulário faz antes de pintar
    const h = app.loanSect(L(), 0);
    assert.match(h, /<label>Indexante \(%\)<input id="l_eur_a" type="text" inputmode="decimal" value="2,635"/);
    porNoDom(h);
    escrever('2,535');
    igual(L().euribor, 2.535);
    igual(app.fineMarca(L(), 'euribor'), '', 'voltar ao valor lido à mão não acende a marca outra vez');
  });

  test('guardar leva o valor escrito para a base', () => {
    mistaDaFine();
    escrever('2,635');
    app.collectProp();   // o onSave do mortOpen colhe antes de gravar
    app.db.properties[0] = app.pForm;
    igual(app.findLoan(app.prop('p1'), 'a').euribor, 2.635);
  });

  test('só uma leitura nova da FINE substitui o que se escreveu', () => {
    mistaDaFine();
    escrever('2,635');
    app.collectProp();
    app.fineAplicar(L(), CAMPOS, app.fineDe('a'), [], PRODUTOS, null);
    igual(L().euribor, 2.535, 'a proposta nova entra');
    igual(app.fineMarca(L(), 'euribor'), ' class="fine-lido"', 'com a marca outra vez');
  });
});
