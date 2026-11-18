// O bloco fiscal do formulário do contrato: o que a Declaração não sabe
// sozinha. As isenções da renda antiga (6H) e do ex-alojamento local (6F)
// com a pergunta que as confirma, e a dica que não fecha a lista; o dia do
// envio ao IHRU e as isenções que servem à data do contrato (o PAA só até
// 31/08/2026); se a renda inclui os consumos; a pergunta das obras antes do
// início; o que se paga à parte para o limite das rendas moderadas; o aviso
// da taxa escrita que não é a da lei do ano; as dicas da celebração, do n.º
// e do Modelo 2 nos contratos anteriores a abril de 2015; o registo do que se
// pagou na assinatura (rendas antecipadas e caução); e a atualização de 2023.
//
// O dia da app é fixo (2026-11-17), salvo no envio ao IHRU (2027-01-20).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));

const copia = (x) => JSON.parse(JSON.stringify(x));

/* um imóvel de arrendamento, um dono, uma inquilina e um contrato declarado
   de habitação permanente
   Recebe: a — a app; extra (opcional) — campos do contrato (o fisco junta-se ao de omissão).
   Devolve: o contrato guardado em db.contracts. */
function monta(a, extra) {
  limpar(a);
  const e = Object.assign({}, extra || {});
  const fisco = Object.assign({ estado: 'declarado', finalidade: 'hp', numero: '1234567' }, e.fisco || {});
  delete e.fisco;
  a.db.owners = [a.normPerson({ id: 'O1', name: 'Rui' })];
  a.db.tenants = [a.normPerson({ id: 'T1', name: 'Ana' })];
  a.db.properties = [a.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'] })];
  a.db.contracts = [a.normContract(Object.assign({ id: 'C1', name: 'Ana · T2', propertyId: 'P1', tenantIds: ['T1'], rent: 1000,
    start: '2024-03-01', end: '2029-02-28', fisco }, e))];
  a.db.transactions = [];
  a.db.recurring = [];
  a.foldState = {};
  return a.db.contracts[0];
}

/* o formulário aberto sobre o contrato C1 (uma cópia, como o ctModal faz)
   Recebe: a — a app.
   Devolve: o HTML do bloco fiscal. */
function form(a) {
  a.cForm = a.normContract(copia(a.contract('C1')));
  return a.fiscoSect();
}

/* um DOM que só conhece os ids do mapa (o resto não está no ecrã)
   Recebe: a — a app; valores — {id: valor}; true é uma caixa marcada.
   Devolve: o mapa dos elementos falsos (para ler o hidden e o texto). */
function domCom(a, valores) {
  const els = {};
  a.document.getElementById = (id) => {
    if (!(id in valores)) return null;
    if (!els[id]) els[id] = { value: valores[id] === true ? 'on' : String(valores[id]), checked: valores[id] === true, hidden: false, textContent: '', innerHTML: '',
      placeholder: '', classList: { add() {}, remove() {} }, addEventListener() {}, focus() {}, scrollIntoView() {}, getAttribute: () => '' };
    return els[id];
  };
  return els;
}

/* as janelas e o ecrã ficam de fora: guarda-se o que se abriu, o que se disse e
   os campos que falharam
   Recebe: a — a app.
   Devolve: {abertas: [{t, b, f}], avisos, erros, desfazer} */
function semEcra(a) {
  const o = { abertas: [], avisos: [], erros: [], desfazer: [] };
  a.openModal = (t, b, f) => { o.abertas.push({ t, b: String(b || ''), f: String(f || '') }); return {}; };
  a.closeModal = () => {};
  a.closeAllModals = () => {};
  a.render = () => {};
  a.buildNav = () => {};
  a.save = () => {};
  a.paintThumbs = () => {};
  a.toast = (m) => { o.avisos.push(String(m)); };
  a.avisoComVer = (m) => { o.avisos.push(String(m)); };
  a.falhaCampo = (id, m) => { o.erros.push(id + ': ' + m); };
  a.comDesfazer = (m, restaurar) => { o.avisos.push(String(m)); o.desfazer.push(restaurar); };
  return o;
}

/* os valores de um sel() desenhado por último com esse id (o registo window.__sel), sem o vazio */
const opcoes = (a, id) => copia(a.__sel[id].options.map((x) => String(x.v)).filter(Boolean));
/* a abertura de uma caixa escondível do bloco fiscal: '' à vista, ' hidden' escondida, null se não está */
const caixa = (h, id) => { const m = new RegExp('<div id="' + id + '"( hidden)?>').exec(h); return m ? (m[1] || '') : null; };

describe('as isenções da renda antiga (6H) e do ex-alojamento local (6F) (D18)', () => {
  test('a dica sem isenção não fecha a lista: há isenções para…, com as do 6H e do 6F', () => {
    const t = app.ctIsencaoTexto('');
    assert.doesNotMatch(t, /Só os contratos de um programa/);
    assert.match(t, /^Há isenções de IRS para alguns contratos/);
    assert.match(t, /rendas antigas/);
    assert.match(t, /ex-alojamento local/);
    assert.match(t, /entre outros/);
    assert.match(t, /a taxa estimada passa a 0 %/);
  });

  test('a renda antiga de 1987: o formulário oferece o 6H; confirmada a pergunta, as rendas de 2025 ficam isentas no 6H', () => {
    monta(app, { name: 'Renda antiga 1987', rent: 180, start: '1987-01-01', end: '' });
    let h = form(app);
    assert.ok(opcoes(app, 'c_fisen').includes('prerau'), 'o 6H está na escolha');
    assert.ok(opcoes(app, 'c_fisen').includes('al'), 'e o 6F (celebrado antes de 2025)');
    assert.equal(caixa(h, 'c_fnrauBox'), ' hidden', 'sem a isenção escolhida, a pergunta fica escondida');
    // escolhida a renda antiga: a pergunta aparece
    app.db.contracts[0].fisco.isencao = 'prerau';
    h = form(app);
    assert.equal(caixa(h, 'c_fnrauBox'), '');
    assert.match(h, /<label>O contrato é anterior ao RAU \(1990\) e ficou sujeito aos arts\. 35\.º ou 36\.º do NRAU\?<div class="sel" id="sel_c_fnrau">/);
    assert.match(h, /EBF art\. 46\.º-A/);
    assert.match(h, /Em «Não sei», a isenção não conta\./);
    // Sim: isento no 6H; Não sei: a isenção não conta
    domCom(app, { c_rent: '180', c_fisen: 'prerau', c_fnrau: '1' });
    app.collectCt();
    assert.equal(app.cForm.fisco.nrau3536, true);
    const t = copia(app.irsTaxa(app.cForm, 2025));
    assert.equal(t.taxa, 0);
    assert.equal(t.isencao.quadro, '6H');
    domCom(app, { c_rent: '180', c_fisen: 'prerau', c_fnrau: '' });
    app.collectCt();
    assert.equal(app.cForm.fisco.nrau3536, null);
    assert.equal(app.irsRate(app.cForm, 2025), 25, 'sem a confirmação, a taxa base');
  });

  test('o ex-alojamento local de 2024: a pergunta do registo e da inscrição, e o 6F só nos celebrados até 31/12/2024', () => {
    monta(app, { name: 'Ex-AL 2024', rent: 950, start: '2024-06-01', end: '2027-05-31', fisco: { celebracao: '2024-05-25', isencao: 'al' } });
    const h = form(app);
    assert.equal(caixa(h, 'c_falBox'), '');
    assert.match(h, /O alojamento local estava registado até 31\/12\/2022, e este contrato foi celebrado e inscrito no Portal das Finanças até 31\/12\/2024\?/);
    assert.match(h, /vale para as rendas até às de 2029/);
    domCom(app, { c_rent: '950', c_fisen: 'al', c_fal: '1' });
    app.collectCt();
    assert.equal(app.cForm.fisco.alRegistado2022, true);
    const t = copia(app.irsTaxa(app.cForm, 2025));
    assert.equal(t.taxa, 0);
    assert.equal(t.isencao.quadro, '6F');
    // celebrado em 2025: o 6F já não se oferece
    monta(app, { start: '2025-03-01', end: '2028-02-29', fisco: { celebracao: '2025-02-20' } });
    form(app);
    assert.ok(!opcoes(app, 'c_fisen').includes('al'));
    assert.ok(opcoes(app, 'c_fisen').includes('prerau'), 'a renda antiga não tem data na versão (INCERTO): fica');
  });

  test('a dica do 6H e do 6F diz que apontam para a linha do 4.1, sem código', () => {
    for (const id of ['prerau', 'al']) {
      const t = app.ctIsencaoTexto(id);
      assert.match(t, /que aponta para a linha do contrato no quadro 4\.1\./, id);
      assert.doesNotMatch(t, /o código ainda não se conhece/, id);
    }
    assert.match(app.ctIsencaoTexto('pma'), /quadro 6D do Anexo F \(código 02\)/, 'controlo: o 6D com código');
  });

  test('o liveNet mostra a pergunta da isenção escolhida e esconde as outras', () => {
    monta(app, { start: '1987-01-01', end: '' });
    app.cForm = app.normContract(copia(app.contract('C1')));
    const els = domCom(app, { c_rent: '180', c_fisen: 'prerau', c_fnrauBox: '', c_falBox: '', c_fihruBox: '', c_fisenHint: '' });
    app.liveNet();
    assert.equal(els.c_fnrauBox.hidden, false);
    assert.equal(els.c_falBox.hidden, true);
    assert.equal(els.c_fihruBox.hidden, true);
    assert.match(els.c_fisenHint.textContent, /quadro 6H/);
    els.c_fisen.value = 'al';
    app.liveNet();
    assert.equal(els.c_fnrauBox.hidden, true);
    assert.equal(els.c_falBox.hidden, false);
  });
});

describe('as condições das isenções: o envio ao IHRU e a data do PAA (D46)', () => {
  test('o PAA só se oferece aos celebrados até 31/08/2026, e o RSAA aos celebrados desde 01/09/2026', () => {
    monta(app, { start: '2026-11-01', end: '2029-10-31', fisco: { celebracao: '2026-10-20' } });
    form(app);
    assert.ok(!opcoes(app, 'c_fisen').includes('paa'), 'celebrado a 2026-10-20: sem PAA');
    assert.ok(opcoes(app, 'c_fisen').includes('rsaa'));
    monta(app, { start: '2026-08-01', end: '2029-07-31', fisco: { celebracao: '2026-08-01' } });
    form(app);
    assert.ok(opcoes(app, 'c_fisen').includes('paa'));
    assert.ok(!opcoes(app, 'c_fisen').includes('rsaa'));
    // sem data nenhuma, todas
    monta(app, { start: '', end: '' });
    form(app);
    assert.ok(opcoes(app, 'c_fisen').includes('paa') && opcoes(app, 'c_fisen').includes('rsaa'));
  });

  test('o PAA já escolhido num contrato celebrado depois fica à vista, e a dica diz porque não conta', () => {
    monta(app, { start: '2026-11-01', end: '2029-10-31', fisco: { celebracao: '2026-10-20', isencao: 'paa' } });
    const h = form(app);
    assert.ok(opcoes(app, 'c_fisen').includes('paa'));
    assert.match(h, /Atenção: a isenção só vale para contratos celebrados até 31\/08\/2026\./);
    assert.match(app.ctFicha('C1'), /Isenção escolhida: PAA\. Nas rendas de 2026, a isenção só vale para contratos celebrados até 31\/08\/2026\./);
  });

  test('o liveNet refaz a escolha da isenção quando a celebração muda', () => {
    monta(app, { start: '2026-11-01', end: '2029-10-31', fisco: { celebracao: '2026-08-10' } });
    form(app);
    assert.ok(opcoes(app, 'c_fisen').includes('paa'));
    const caixaSel = { parentNode: { replaceChild(novo) { caixaSel.trocada = novo; } } };
    const els = domCom(app, { c_rent: '1000', c_fcel: '2026-10-20', c_fisen: '' });
    const getAntes = app.document.getElementById;
    app.document.getElementById = (id) => (id === 'sel_c_fisen' ? caixaSel : getAntes(id));
    const criar = app.document.createElement;
    app.document.createElement = () => ({ set innerHTML(h) { this.h = h; }, get firstElementChild() { return { html: this.h }; } });
    try {
      app.liveNet();
    } finally { app.document.createElement = criar; }
    assert.ok(caixaSel.trocada, 'trocou a escolha');
    assert.ok(!opcoes(app, 'c_fisen').includes('paa'), 'já sem o PAA');
    assert.ok(els.c_fcel);
  });

  test('RSAA: o dia do envio ao IHRU no formulário; com ele a tempo, as rendas de 2026 ficam isentas', () => {
    const b = carregarApp({ hoje: '2027-01-20' });
    try {
      monta(b, { name: 'RSAA', rent: 700, start: '2026-10-01', end: '2029-09-30', fisco: { celebracao: '2026-09-20', isencao: 'rsaa' } });
      const h = form(b);
      assert.equal(caixa(h, 'c_fihruBox'), '');
      assert.match(h, /<label>Enviado ao IHRU a<input id="c_fihru" type="date" value="" max="2027-01-20"/);
      assert.match(h, /plataforma do IHRU até 15\/01\/2027: sem isso, as rendas não ficam isentas de IRS/);
      assert.equal(b.irsRate(b.cForm, 2026), 10, 'sem o dia, passado o prazo, a isenção não conta');
      domCom(b, { c_rent: '700', c_fisen: 'rsaa', c_fihru: '2027-01-10' });
      b.collectCt();
      assert.equal(b.cForm.fisco.ihru, '2027-01-10');
      assert.equal(b.irsRate(b.cForm, 2026), 0);
      // as regras do «Marcar como enviado»: nem depois de hoje, nem antes da celebração
      b.cForm.fisco.ihru = '2027-02-01';
      assert.deepEqual(copia(b.ctFiscoErro(b.cForm)), { id: 'c_fihru', msg: 'O dia do envio não pode ser depois de hoje.' });
      b.cForm.fisco.ihru = '2026-09-01';
      assert.deepEqual(copia(b.ctFiscoErro(b.cForm)), { id: 'c_fihru', msg: 'O dia do envio não pode ser antes da celebração (20/09/2026).' });
      b.cForm.fisco.ihru = '2027-01-10';
      assert.equal(b.ctFiscoErro(b.cForm), null);
      // a ficha diz o dia
      b.db.contracts[0].fisco.ihru = '2027-01-10';
      assert.match(b.ctFicha('C1'), /<span>Envio ao IHRU<\/span><b>10\/01\/2027<\/b>/);
      // sem o dia: a ficha diz porque não conta, com o caminho para a pergunta
      b.db.contracts[0].fisco.ihru = '';
      assert.match(b.ctFicha('C1'), /Nas rendas de 2027, sem a data do envio ao IHRU, a isenção não conta\.[\s\S]*data-click="ctIrParaPergunta\('C1','c_fihru'\)">Responder</);
    } finally { repor(b); }
  });
});

describe('os consumos incluídos na renda (D26)', () => {
  test('um interruptor no bloco fiscal, desligado por omissão; o collectCt grava fisco.consumosIncluidos', () => {
    monta(app);
    const h = form(app);
    assert.match(h, /<b>A renda inclui os consumos<\/b>/);
    assert.match(h, /campo 30/);
    assert.match(h, /<input type="checkbox" role="switch" class="ct-sw" id="c_fcons">/);
    domCom(app, { c_rent: '1000', c_fcons: true });
    app.collectCt();
    assert.equal(app.cForm.fisco.consumosIncluidos, true);
    domCom(app, { c_rent: '1000', c_fcons: false });
    app.collectCt();
    assert.equal(app.cForm.fisco.consumosIncluidos, false);
    app.db.contracts[0].fisco.consumosIncluidos = true;
    assert.match(app.ctFicha('C1'), /<span>Consumos<\/span><b>incluídos na renda<\/b>/);
  });
});

describe('as obras antes do início (D28)', () => {
  /* uma obra de conservação paga no imóvel P1 */
  const obra = (a, data, valor) => a.db.transactions.push(a.normTx({ kind: 'expense', label: 'Pintura', amount: valor, date: data, propertyId: 'P1', irsCol: 'conservacao' }));

  test('com obras nos 24 meses antes do primeiro contrato do imóvel, pergunta se o imóvel esteve só à espera de inquilino', () => {
    monta(app, { start: '2026-06-01', end: '2031-05-31' });
    obra(app, '2025-09-15', 1500);
    obra(app, '2026-01-10', 3000);
    const h = form(app);
    assert.equal(caixa(h, 'c_fobrasBox'), '', 'o primeiro contrato do imóvel não fica de fora');
    assert.match(h, /Entre setembro de 2025 e 01\/06\/2026, o imóvel esteve só à espera de inquilino, sem uso teu, da família nem alojamento local\?/);
    assert.match(h, /CIRS art\. 41\.º n\.º 7/);
    for (const [v, esperado] of [['1', true], ['0', false], ['', null]]) {
      domCom(app, { c_rent: '1000', c_fobras: v });
      app.collectCt();
      assert.equal(app.cForm.fisco.obrasSemOutroUso, esperado, v);
    }
    app.db.contracts[0].fisco.obrasSemOutroUso = true;
    assert.match(app.ctFicha('C1'), /<span>Obras antes do início<\/span><b>o imóvel esteve só à espera de inquilino<\/b>/);
  });

  test('sem obras nesses 24 meses (ou pagas com outro contrato em vigor), a pergunta fica escondida', () => {
    monta(app, { start: '2026-06-01', end: '2031-05-31' });
    obra(app, '2024-03-01', 900);
    assert.equal(caixa(form(app), 'c_fobrasBox'), ' hidden', 'mais de 24 meses antes');
    monta(app, { start: '2026-06-01', end: '2031-05-31' });
    app.db.contracts.push(app.normContract({ id: 'C0', propertyId: 'P1', tenantIds: ['T1'], rent: 800, start: '2025-01-01', end: '2025-12-31', active: false }));
    obra(app, '2025-09-15', 1500);
    assert.equal(caixa(form(app), 'c_fobrasBox'), ' hidden', 'conservação com outro contrato em vigor: é desse');
  });

  test('o liveNet mostra a pergunta quando o início muda para depois das obras', () => {
    monta(app, { start: '2025-01-01', end: '2029-12-31' });
    obra(app, '2025-09-15', 1500);
    app.cForm = app.normContract(copia(app.contract('C1')));
    const els = domCom(app, { c_rent: '1000', c_start: '2026-06-01', c_fobrasBox: '', c_fobrasPerg: '' });
    app.liveNet();
    assert.equal(els.c_fobrasBox.hidden, false);
    assert.match(els.c_fobrasPerg.textContent, /^Entre setembro de 2025 e 01\/06\/2026/);
    els.c_start.value = '2025-01-01';
    app.liveNet();
    assert.equal(els.c_fobrasBox.hidden, true);
  });
});

describe('o que se paga à parte e o limite das rendas moderadas (D48)', () => {
  test('o campo «Móveis e serviços pagos à parte (€/mês)» com a frase do limite; conta no teste dos 10 %', () => {
    monta(app, { rent: 2250, start: '2024-03-01', end: '2029-02-28' });
    const h = form(app);
    assert.match(h, /<label>Móveis e serviços pagos à parte \(€\/mês\)<input id="c_fextras" type="text" inputmode="decimal" class="num" value="" placeholder="Opcional"[^>]*autocomplete="off">/);
    assert.match(h, /Para o limite das rendas moderadas \(10 % até 2[\s.  ]?300[\s  ]€ por mês\), conta a renda com o que o inquilino paga à parte por móveis, equipamentos e serviços, mesmo num contrato separado \(DL 97\/2026, art\. 3\.º\)/);
    assert.equal(app.irsRate(app.cForm, 2026), 10);
    domCom(app, { c_rent: '2250', c_start: '2024-03-01', c_end: '2029-02-28', c_fextras: '100' });
    app.collectCt();
    assert.equal(app.cForm.fisco.extrasMensais, 100);
    assert.equal(app.irsRate(app.cForm, 2026), 15, '2 350 € por mês: acima do limite, fica a da duração');
    domCom(app, { c_rent: '2250', c_fextras: '-5' });
    assert.deepEqual(copia(app.ctFiscoErro(app.cForm)), { id: 'c_fextras', msg: 'O que se paga à parte não pode ser negativo.' });
  });
});

describe('a taxa escrita que não é a da lei do ano (D17)', () => {
  test('o formulário avisa quando a taxa escrita difere da das regras do ano, e cala-se quando é igual ou em branco', () => {
    monta(app, { rent: 900, taxRate: 25, start: '2024-03-01', end: '2027-02-28' });
    app.cForm = app.normContract(copia(app.contract('C1')));
    let h = app.ctBody();
    assert.match(h, /<p class="hint ct-colado" id="c_taxAviso"><b>Escreveste 25 %, e pelas regras de 2026 a taxa deste contrato é 10 % \(renda moderada\)\. Na Declaração conta sempre a da lei de cada ano: a escrita serve só para a renda líquida\.<\/b><\/p>/);
    app.cForm.taxRate = 10;
    h = app.ctBody();
    assert.match(h, /<p class="hint ct-colado" id="c_taxAviso" hidden>/);
    app.cForm.taxRate = 0;
    assert.equal(app.ctTaxaEscritaAviso(app.cForm), '');
  });

  test('o liveNet acende e apaga o aviso enquanto se escreve a taxa', () => {
    monta(app, { rent: 900, start: '2024-03-01', end: '2027-02-28' });
    app.cForm = app.normContract(copia(app.contract('C1')));
    const els = domCom(app, { c_rent: '900', c_tax: '28', c_taxAviso: '' });
    app.liveNet();
    assert.equal(els.c_taxAviso.hidden, false);
    assert.match(els.c_taxAviso.innerHTML, /Escreveste 28 %/);
    els.c_tax.value = '';
    app.liveNet();
    assert.equal(els.c_taxAviso.hidden, true);
  });
});

describe('a data de celebração (D108)', () => {
  test('a dica diz para que serve e que o Anexo F leva a data de início, não esta', () => {
    monta(app);
    const h = form(app);
    assert.doesNotMatch(h, /o quadro 4\.2 do Anexo F pede-o/);
    assert.match(h, /O dia em que assinaram: decide o regime da redução pela duração e se o quadro 4\.2C se aplica \(contratos celebrados desde 2024\)\. No Anexo F vai a data de início, não esta\./);
  });
});

describe('os contratos anteriores a abril de 2015 não têm Modelo 2 (D85)', () => {
  test('declarado: o n.º vem do registo dos elementos mínimos', () => {
    monta(app, { start: '2012-05-01', end: '' });
    const h = form(app);
    assert.match(h, /<div class="hint ct-colado" id="c_fnumHint">Começou antes de abril de 2015: não tem Modelo 2\. O n\.º vem do registo dos elementos mínimos do contrato no Portal das Finanças/);
    assert.doesNotMatch(h, /Vem no comprovativo do Modelo 2/);
    monta(app, { start: '2015-04-01', end: '' });
    assert.match(form(app), /Vem no comprovativo do Modelo 2/, 'desde 1 de abril de 2015, o Modelo 2');
  });

  test('por indicar: sem o Modelo 2 nem o prazo de 2012, no formulário e na ficha', () => {
    monta(app, { start: '2012-05-01', end: '', fisco: { estado: '' } });
    const h = form(app);
    assert.doesNotMatch(h, /O prazo é 30\/06\/2012/);
    assert.doesNotMatch(h, /Comunicaste este contrato às Finanças \(Modelo 2\)/);
    assert.match(h, /Registaste este contrato no Portal das Finanças\? Começou antes de abril de 2015: não tem Modelo 2, regista-se com os elementos mínimos do contrato/);
    const f = app.ctFicha('C1');
    assert.match(f, /Começou antes de abril de 2015: não tem Modelo 2\. Registaste-o no Portal das Finanças/);
    assert.doesNotMatch(f, /Comunicaste este contrato às Finanças \(Modelo 2\)/);
    monta(app, { start: '2026-03-10', end: '', fisco: { estado: '' } });
    assert.match(form(app), /O prazo é 30\/04\/2026, o fim do mês seguinte ao início\./, 'controlo: os de agora têm o prazo');
  });
});

describe('o que se pagou na assinatura: as rendas antecipadas e a caução (D56)', () => {
  /* o cenário do Anexo A: assinado a 15/12/2025, início a 01/01/2026, 800 €, 2 antecipadas e 800 € de caução */
  const novo = (a) => {
    monta(a, { start: '2026-01-01', end: '2028-12-31', rent: 800, payDay: 1, advance: 2, deposit: 800, fisco: { celebracao: '2025-12-15' } });
    a.db.contracts = [];
    a.cForm = a.normContract({ id: 'C1', name: 'Ana · T2', propertyId: 'P1', tenantIds: ['T1'], rent: 800, payDay: 1, start: '2026-01-01', end: '2028-12-31',
      advance: 2, deposit: 800, fisco: { estado: 'declarado', finalidade: 'hp', numero: '999', celebracao: '2025-12-15' } });
  };

  test('ao guardar, propõe as duas rendas com o dia da celebração e o mês de cada uma, e a caução', () => {
    const o = semEcra(app);
    novo(app);
    app.ctGravar();
    const j = o.abertas[o.abertas.length - 1];
    assert.equal(j.t, 'O que se pagou na assinatura');
    assert.match(j.b, /<b>Renda de janeiro de 2026<\/b><span class="small">800,00[^<]*, paga à cabeça<\/span><\/span><input type="checkbox" role="switch" class="ct-sw" id="c_antItem_0" checked>/);
    assert.match(j.b, /<b>Renda de fevereiro de 2026<\/b>/);
    assert.match(j.b, /<b>Caução<\/b><span class="small">800,00[^<]*, a caução do contrato<\/span>/);
    assert.match(j.b, /<label>Pago a <span class="req">\*<\/span><input id="c_antData" type="date" value="2025-12-15"/);
    assert.match(j.f, /data-click="ctAntecipadasOk\('C1'\)">Registar</);
    assert.match(j.f, />Agora não</);
    // Registar: três movimentos com a data da celebração; cada renda com o mês a que respeita
    domCom(app, { c_antData: '2025-12-15', c_antItem_0: true, c_antItem_1: true, c_antItem_2: true });
    app.ctAntecipadasOk('C1');
    const ts = app.db.transactions.map((t) => ({ data: t.date, periodo: t.periodo, valor: t.amount, papel: app.irsReceitaDe(t).papel, ct: t.contractId }));
    assert.deepEqual(copia(ts), [
      { data: '2025-12-15', periodo: '2026-01', valor: 800, papel: 'renda', ct: 'C1' },
      { data: '2025-12-15', periodo: '2026-02', valor: 800, papel: 'renda', ct: 'C1' },
      { data: '2025-12-15', periodo: '', valor: 800, papel: 'caucao', ct: 'C1' }]);
    assert.match(o.avisos[o.avisos.length - 1], /3 movimentos registados\./);
    // a Declaração de 2025 já as tem, e o aviso das antecipadas cala-se
    const r = app.resumoFiscal(2025, 'O1');
    assert.ok(r.totais.rendas >= 1600, 'as rendas recebidas em dezembro de 2025 vão ao Anexo F de 2025');
    assert.ok(!r.avisos.some((x) => /rendas antecipadas/.test(x.texto)));
    // o «Anular» tira-as
    o.desfazer[o.desfazer.length - 1]();
    assert.equal(app.db.transactions.length, 0);
  });

  test('só o que está marcado; um mês que já tem a renda não se propõe; gravar sem mudar não propõe outra vez', () => {
    const o = semEcra(app);
    novo(app);
    app.db.transactions.push(app.normTx({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 800, date: '2025-12-20', periodo: '2026-01', propertyId: 'P1', contractId: 'C1' }));
    app.ctGravar();
    const j = o.abertas[o.abertas.length - 1];
    assert.doesNotMatch(j.b, /janeiro de 2026/);
    assert.match(j.b, /Renda de fevereiro de 2026/);
    domCom(app, { c_antData: '2025-12-15', c_antItem_0: true, c_antItem_1: false });
    app.ctAntecipadasOk('C1');
    assert.equal(app.db.transactions.length, 2, 'a de fevereiro; a caução ficou desmarcada');
    const n = o.abertas.length;
    app.cForm = app.normContract(copia(app.contract('C1')));
    app.ctGravar();
    assert.equal(o.abertas.length, n, 'nada mudou nas antecipadas nem na caução: não pergunta');
  });

  test('o dia: nunca depois de hoje; sem celebração, o início, ou hoje num contrato por começar', () => {
    const o = semEcra(app);
    novo(app);
    app.ctGravar();
    domCom(app, { c_antData: '2026-12-01' });
    app.ctAntecipadasOk('C1');
    assert.deepEqual(o.erros, ['c_antData: O dia não pode ser depois de hoje.']);
    domCom(app, { c_antData: '' });
    app.ctAntecipadasOk('C1');
    assert.equal(o.erros[1], 'c_antData: Indica o dia em que se pagou.');
    assert.equal(app.db.transactions.length, 0);
    app.db.contracts[0].fisco.celebracao = '';
    assert.equal(app.ctAntecipadasPorRegistar(app.db.contracts[0]).data, '2026-01-01');
    app.db.contracts[0].start = '2027-01-01';
    assert.equal(app.ctAntecipadasPorRegistar(app.db.contracts[0]).data, '2026-11-17');
    app.db.contracts[0].advance = 0; app.db.contracts[0].deposit = 0;
    assert.equal(app.ctAntecipadasPorRegistar(app.db.contracts[0]), null, 'sem antecipadas nem caução, nada');
  });
});

describe('a atualização da renda de 2023 (D76)', () => {
  test('a pergunta só nos contratos começados antes de 2022; o collectCt grava sim, não ou por responder', () => {
    monta(app, { start: '2020-03-01', end: '2030-02-28' });
    const h = form(app);
    assert.equal(caixa(h, 'c_fat23Box'), '');
    assert.match(h, /<label>A renda de 2023 subiu mais de 2 %\?<div class="sel" id="sel_c_fat23">/);
    assert.match(h, /coeficiente de 1,02/);
    for (const v of ['sim', 'nao', '']) {
      domCom(app, { c_rent: '1000', c_fat23: v });
      app.collectCt();
      assert.equal(app.cForm.fisco.atualizacao2023, v);
    }
    app.db.contracts[0].fisco.atualizacao2023 = 'nao';
    assert.match(app.ctFicha('C1'), /<span>Renda de 2023<\/span><b>não subiu mais de 2 %<\/b>/);
    monta(app, { start: '2022-01-01', end: '2027-12-31' });
    assert.equal(caixa(form(app), 'c_fat23Box'), ' hidden', 'começado em 2022: não se aplica');
  });
});

describe('a ficha leva à pergunta que falta', () => {
  test('a renda antiga sem a confirmação: a ficha diz porque não conta, e «Responder» abre o formulário na pergunta', () => {
    const o = semEcra(app);
    monta(app, { start: '1987-01-01', end: '', fisco: { isencao: 'prerau' } });
    const h = app.ctFicha('C1');
    assert.match(h, /Isenção escolhida: renda antiga \(anterior ao RAU\)\. Nas rendas de 2026, sem confirmares que o contrato está sujeito aos arts\. 35\.º ou 36\.º do NRAU, a isenção não conta\./);
    assert.match(h, /data-click="ctIrParaPergunta\('C1','c_fnrau'\)">Responder<\/button>/);
    app.ctIrParaPergunta('C1', 'c_fnrau');
    assert.equal(o.abertas[o.abertas.length - 1].t, 'Editar contrato');
    assert.equal(app.cForm.id, 'C1');
    app.db.contracts[0].fisco.nrau3536 = true;
    const h2 = app.ctFicha('C1');
    assert.doesNotMatch(h2, /ctIrParaPergunta/);
    assert.match(h2, /Isento de IRS: Renda antiga[^<]*quadro 6H aponta para ela\./);
  });
});
