// O formulário e a ficha do contrato com um caminho linear (a maqueta 1):
// depois de «Sim, tem n.º» ficam à vista o n.º e a finalidade, a celebração
// atrás de «Foi assinado noutro dia», o que se paga à parte com a sua
// pergunta, e a isenção e a categoria B atrás de «Este contrato tem alguma
// particularidade fiscal?»; o que está numa caixa fechada grava-se em branco.
// Os três estados respondem à pergunta do grupo; o «Renovável» saiu; os
// encargos do inquilino e os consumos numa pergunta; o imposto atrás de
// «Escrever outra taxa»; a categoria B ligada à vista em qualquer estado e
// país, sem recibos de renda; a gestão florestal e o arrendamento rural; as
// perguntas dos n.os 23 e 24 com as suas datas e as portarias do ano; as dicas
// dos móveis à parte e do ex-alojamento local; o «Registar recebimento» de um
// contrato terminado; e a dispensa dos recibos pela situação fiscal do ano.
//
// O dia da app é fixo (2026-11-19).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-19' });
afterEach(() => repor(app));

const copia = (x) => JSON.parse(JSON.stringify(x));

/* um imóvel de arrendamento de um dono, uma inquilina com NIF e um contrato
   declarado de habitação permanente, novo, de 900 €
   Recebe: extra (opcional) — campos do contrato (o fisco junta-se ao de
   omissão); imovel (opcional) — campos do imóvel.
   Devolve: o contrato guardado em db.contracts. */
function monta(extra, imovel) {
  limpar(app);
  const e = Object.assign({}, extra || {});
  const fisco = Object.assign({ estado: 'declarado', finalidade: 'hp', numero: '1234567' }, e.fisco || {});
  delete e.fisco;
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Rui' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana', nif: '123456789' })];
  app.db.properties = [app.normProp(Object.assign({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'],
    freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }, imovel || {}))];
  app.db.contracts = [app.normContract(Object.assign({ id: 'C1', name: 'Ana · T2', propertyId: 'P1', tenantIds: ['T1'], rent: 900,
    start: '2026-11-01', end: '2027-10-31', fisco }, e))];
  app.db.transactions = [];
  app.db.recurring = [];
  app.foldState = {};
  app._ctAbertas = {};
  return app.db.contracts[0];
}

/* o formulário aberto sobre o contrato C1 (uma cópia, como o ctModal faz) */
const abre = () => { app.cForm = app.normContract(copia(app.contract('C1'))); };
/* o bloco fiscal e o formulário inteiro do contrato C1 */
const fisco = () => { abre(); return app.fiscoSect(); };
const corpo = () => { abre(); return app.ctBody(); };

/* O elemento com este id está no HTML e à vista — nem ele nem nenhum dos de
   fora dele tem o atributo hidden? Lê as etiquetas por ordem, com a pilha das
   abertas (as vazias e as que se fecham sozinhas não entram).
   Recebe: html — o HTML; id — o id.
   Devolve: null se não está no HTML; senão true (à vista) ou false (escondido). */
function aVista(html, id) {
  const vazias = /^(input|br|hr|img|meta|link|area|base|col|embed|source|track|wbr|path|circle|rect|line|polyline|polygon)$/i;
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  const pilha = [];
  let m;
  while ((m = re.exec(html))) {
    const [, fecha, tag, attrs] = m;
    if (fecha) {
      for (let i = pilha.length - 1; i >= 0; i--) if (pilha[i].tag === tag.toLowerCase()) { pilha.length = i; break; }
      continue;
    }
    const escondido = /\shidden(\s|=|$|\/)/.test(attrs + ' ');
    if (new RegExp('\\bid="' + id + '"').test(attrs)) return !escondido && !pilha.some((x) => x.hidden);
    if (vazias.test(tag) || /\/\s*$/.test(attrs)) continue;
    pilha.push({ tag: tag.toLowerCase(), hidden: escondido });
  }
  return null;
}

/* um DOM que só conhece os ids do mapa (o resto não está no ecrã)
   Recebe: valores — {id: valor}; true e false são caixas marcadas ou não.
   Devolve: o mapa dos elementos falsos. */
function domCom(valores) {
  const els = {};
  app.document.getElementById = (id) => {
    if (!(id in valores)) return null;
    if (!els[id]) els[id] = { value: valores[id] === true ? 'on' : valores[id] === false ? '' : String(valores[id]), checked: valores[id] === true,
      hidden: false, textContent: '', innerHTML: '', placeholder: '', classList: { add() {}, remove() {} }, addEventListener() {}, focus() {},
      scrollIntoView() {}, getAttribute: () => '' };
    return els[id];
  };
  return els;
}

/* as opções de um sel() que o formulário desenhou */
const opcoes = (id) => copia(((app.window.__sel || {})[id] || { options: [] }).options.map((o) => o.v));
/* o texto sem etiquetas, com os espaços juntos */
const texto = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('N060 — depois de «Sim, tem n.º», o n.º e a finalidade; o resto quando conta', () => {
  test('um contrato novo de 900 €: à vista o n.º, a finalidade e as três perguntas; nada da lista de antes', () => {
    monta();
    const h = fisco();
    for (const id of ['c_fnum', 'c_ffin', 'c_fcel', 'c_fextrasQ', 'c_fpart']) assert.equal(aVista(h, id), true, id + ' à vista');
    for (const id of ['c_fisen', 'c_fcatb', 'c_fextras']) assert.equal(aVista(h, id), false, id + ' escondido');
    assert.equal(aVista(h, 'c_fren'), null, 'o «Renovável» saiu');
    assert.equal(aVista(h, 'c_fcelOutro'), null, '«Foi assinado noutro dia» saiu (KAN-160)');
    assert.doesNotMatch(h, /Renovável/);
    assert.doesNotMatch(h, /addRenov\(\)|Adicionar renovação/, 'num contrato novo não há renovações à mão');
    assert.match(h, /<b>Este contrato tem alguma particularidade fiscal\?<\/b>/);
    assert.match(h, /<label>Data de celebração<input id="c_fcel" type="date"/);
  });

  test('uma isenção ou a categoria B guardadas abrem a particularidade', () => {
    monta({ start: '2026-01-01', end: '2030-12-31', fisco: { celebracao: '2025-12-20', isencao: 'paa' } });
    let h = fisco();
    assert.match(h, /id="c_fpart" checked/);
    assert.equal(aVista(h, 'c_fisen'), true);
    monta({ fisco: { categoriaB: true } });
    h = fisco();
    assert.match(h, /id="c_fpart" checked/);
    assert.equal(aVista(h, 'c_fcatb'), true);
  });

  test('a isenção só se oferece à habitação: num não habitacional ou num DHD, nenhuma (a escolhida fica)', () => {
    monta({ fisco: { finalidade: 'nh' } });
    let h = fisco();
    assert.deepEqual(opcoes('c_fisen'), [''], 'só «Nenhuma»');
    assert.equal(aVista(h, 'c_fisenBox'), false);
    monta({ fisco: { finalidade: 'dhd' } });
    fisco();
    assert.deepEqual(opcoes('c_fisen'), ['']);
    monta({ fisco: { finalidade: 'nh', isencao: 'pma' } });
    h = fisco();
    assert.deepEqual(opcoes('c_fisen'), ['', 'pma'], 'a já escolhida continua para se trocar');
    assert.equal(aVista(h, 'c_fisen'), true);
    monta({ fisco: { finalidade: '' } });
    fisco();
    assert.ok(opcoes('c_fisen').includes('pma'), 'com a finalidade em branco, todas');
  });

  test('KAN-160: a data de celebração sempre à vista — a escrita, o início num antigo sem ela, hoje num novo', () => {
    monta({ fisco: { celebracao: '2026-10-20' } });
    let h = fisco();
    assert.equal(aVista(h, 'c_fcel'), true);
    assert.match(h, /id="c_fcel" type="date" value="2026-10-20" data-change/, 'a escrita, sem seguir o início');
    monta({ start: '2024-03-01', end: '2029-02-28' });
    h = fisco();
    assert.match(h, /id="c_fcel" type="date" value="2024-03-01" data-segue="inicio"/, 'um antigo sem celebração abre com o início, e segue-o');
    /* um contrato novo (o ctModal sem id: ainda não está na base) vem com hoje */
    monta();
    app.cForm = app.normContract({ propertyId: 'P1', tenantIds: ['T1'], rent: 900, start: '2026-12-01', fisco: { estado: 'declarado' } });
    h = app.fiscoSect();
    assert.match(h, /id="c_fcel" type="date" value="2026-11-19" data-change/, 'hoje, sem seguir o início');
    assert.equal(aVista(h, 'c_fcelCaso'), false, 'antes do início: nenhum aviso');
    /* um novo de um contrato que já começou: hoje fica, e avisa */
    app.cForm = app.normContract({ propertyId: 'P1', tenantIds: ['T1'], rent: 900, start: '2026-01-01', fisco: { estado: 'declarado' } });
    h = app.fiscoSect();
    assert.equal(aVista(h, 'c_fcelCaso'), true);
    assert.match(texto(h), /Esta data é depois do início \(01\/01\/2026\)\. Se assinaram antes ou no próprio dia, corrige-a\./);
    assert.match(h, /class="hint ct-colado ct-caso ct-caso-aviso" id="c_fcelCaso"/, 'o aviso pela cor da frente');
    /* depois de lida uma vez, em branco é o início (o novo já não volta a hoje) */
    app._ctAbertas.c_fcel = true;
    h = app.fiscoSect();
    assert.match(h, /id="c_fcel" type="date" value="2026-01-01" data-segue="inicio"/);
    app._ctAbertas = {};
  });

  test('KAN-160: gravar um contrato antigo sem mexer não muda a celebração nem a taxa', () => {
    const c = monta({ start: '2024-03-01', end: '2034-02-28' });
    const taxa = app.irsRate(c);
    abre();
    /* o campo abre com o início, e o collectCt lê-o assim */
    domCom({ c_rent: '900', c_active: true, c_start: '2024-03-01', c_end: '2034-02-28', c_fcel: '2024-03-01' });
    app.collectCt();
    assert.equal(app.cForm.fisco.celebracao, '', 'o dia do início grava-se em branco: o mesmo que antes');
    assert.equal(app.irsRate(app.cForm), taxa, 'a taxa é a mesma');
    assert.equal(app.ctEmEdicao().fisco.celebracao, '', 'a estimativa ao vivo também');
    /* outro dia escreve-se */
    domCom({ c_rent: '900', c_active: true, c_start: '2024-03-01', c_end: '2034-02-28', c_fcel: '2024-02-15' });
    app.collectCt();
    assert.equal(app.cForm.fisco.celebracao, '2024-02-15');
  });

  test('KAN-160: com o início mudado, a celebração que vinha do início segue-o; a escrita à mão fica', () => {
    monta({ start: '2024-03-01', end: '2029-02-28' });
    abre();
    const els = domCom({ c_start: '2024-04-01', c_fcel: '2024-03-01', c_rent: '900' });
    els.c_fcel = { value: '2024-03-01', getAttribute: (n) => (n === 'data-segue' ? 'inicio' : null), removeAttribute() {}, setAttribute() {}, type: 'date', tagName: 'INPUT' };
    app.ctInicioMudou();
    assert.equal(els.c_fcel.value, '2024-04-01', 'segue o início novo');
    els.c_fcel = { value: '2024-02-10', getAttribute: () => null, removeAttribute() {}, setAttribute() {}, type: 'date', tagName: 'INPUT' };
    app.ctInicioMudou();
    assert.equal(els.c_fcel.value, '2024-02-10', 'a escrita à mão não se mexe');
  });

  test('as renovações à mão: com renovações, com o fim passado, ou num contrato que começou antes do ano anterior', () => {
    monta({ start: '2019-03-01', end: '2028-02-29' });
    assert.match(fisco(), /Adicionar renovação/, 'um contrato de 2019 registado agora');
    monta({ start: '2025-06-01', end: '2026-05-31' });
    assert.match(fisco(), /Adicionar renovação/, 'o fim passou');
    monta({ start: '2025-06-01', end: '2027-05-31', fisco: { renovacoes: [{ id: 'R1', inicio: '2026-06-01', fim: '2027-05-31' }] } });
    assert.match(fisco(), /id="c_rini_R1"/);
    monta({ start: '2025-06-01', end: '2027-05-31' });
    assert.doesNotMatch(fisco(), /Adicionar renovação/, 'começou no ano anterior e o fim ainda não passou');
  });

  test('o collectCt: uma caixa fechada grava-se em branco, e o «Renovável» antigo fica como estava', () => {
    monta({ fisco: { renovavel: true } });
    abre();
    domCom({ c_rent: '900', c_active: true, c_start: '2026-11-01', c_fpart: false, c_fisen: 'pma', c_fcatb: true,
      c_fcel: '2026-11-01', c_fextrasQ: false, c_fextras: '300', c_fren: '0' });
    app.collectCt();
    const f = app.cForm.fisco;
    assert.equal(f.isencao, '', 'a isenção na particularidade fechada');
    assert.equal(f.categoriaB, false, 'a categoria B na particularidade fechada');
    assert.equal(f.celebracao, '', 'a celebração no dia do início grava-se em branco (KAN-160)');
    assert.equal(f.extrasMensais, 0, 'sem «Sim» à pergunta, nada à parte');
    assert.equal(f.renovavel, true, 'o «Renovável» já não se lê do ecrã');
    domCom({ c_rent: '900', c_active: true, c_start: '2026-11-01', c_fpart: true, c_fisen: 'pma', c_fcatb: false,
      c_fcel: '2026-10-20', c_fextrasQ: true, c_fextras: '300' });
    app.collectCt();
    assert.equal(app.cForm.fisco.isencao, 'pma');
    assert.equal(app.cForm.fisco.celebracao, '2026-10-20');
    assert.equal(app.cForm.fisco.extrasMensais, 300);
  });

  test('a ficha já não diz «renovável»', () => {
    const c = monta({ fisco: { celebracao: '2026-10-20', renovavel: true } });
    const t = texto(app.ctAtDaFicha(c));
    assert.match(t, /Celebrado a 20\/10\/2026/);
    assert.doesNotMatch(t, /renovável/);
  });
});

describe('N061 — os três estados respondem à pergunta do grupo', () => {
  test('«Já o comunicaste às Finanças?»: Ainda não, Sim, tem n.º, Não vou declarar — os valores de sempre', () => {
    monta({ fisco: { estado: '' } });
    const h = fisco();
    assert.match(h, /<span class="flabel" id="c_fiscoRot">Já o comunicaste às Finanças\?<\/span>/);
    assert.match(h, /aria-checked="true" class="on" data-toca="rascunho" data-click="setFiscoEstado\(''\)">Ainda não</);
    assert.match(h, /data-click="setFiscoEstado\('declarado'\)">Sim, tem n\.º</);
    assert.match(h, /data-click="setFiscoEstado\('naoDeclarado'\)">Não vou declarar</);
    assert.doesNotMatch(h, />Por indicar<|>Declarado<|>Não declarado</);
  });

  test('«Ainda não» diz que as rendas contam e o prazo do Modelo 2; o prazo passado diz-se no passado', () => {
    monta({ fisco: { estado: '' } });
    let t = texto(fisco());
    /* KAN-161: por baixo, só o prazo deste contrato; a explicação inteira no «?» */
    assert.match(t, /Ainda não Sim, tem n\.º Não vou declarar O prazo é 31\/12\/2026, o fim do mês seguinte ao início\./);
    assert.match(app.ctAjudaTexto('at', app.cForm), /Com «Ainda não», as rendas contam no resumo do Anexo F e a app lembra-te o prazo do Modelo 2\. O prazo é 31\/12\/2026, o fim do mês seguinte ao início\./);
    assert.doesNotMatch(t, /Comunicaste este contrato/);
    monta({ start: '2025-03-01', end: '2027-02-28', fisco: { estado: '' } });
    t = texto(fisco());
    assert.match(t, /O prazo era 30\/04\/2025, o fim do mês seguinte ao início: comunica-o quanto antes\./);
  });

  test('«Não vou declarar» não diz que o Modelo 2 deixa de ser devido; fora de Portugal a pergunta é outra', () => {
    monta({ fisco: { estado: 'naoDeclarado' } });
    fisco();
    assert.match(app.ctAjudaTexto('at', app.cForm), /\(o Modelo 2\) é do Imposto do Selo: esta escolha só diz respeito ao IRS\./);
    monta({ fisco: { estado: '' } }, { pais: 'França', paisCodigo: '250' });
    const h = fisco();
    assert.match(h, /Vais declarar estas rendas no IRS\?/);
    assert.match(h, />Ainda não sei</);
    assert.doesNotMatch(h, /Sim, tem n\.º/);
  });
});

describe('N015 — a categoria B atrás de «Tens atividade aberta com estas rendas na categoria B?»', () => {
  test('num contrato declarado comum não está à vista; a pergunta e a dica dizem quem responde «Sim»', () => {
    monta();
    const h = fisco();
    assert.equal(aVista(h, 'c_fcatb'), false);
    assert.match(h, /<b>Tens atividade aberta com estas rendas na categoria B\?<\/b>/);
    assert.doesNotMatch(h, /Rendas tributadas na categoria B<\/b>/);
    const d = app.ctCategoriaBDica();
    assert.match(d, /Só com atividade aberta/);
    assert.match(d, /Sem atividade aberta, fica desligado\./);
    assert.doesNotMatch(d, /recibo/);
  });
});

describe('N056 — a categoria B ligada vê-se em qualquer estado e país', () => {
  test('«Ainda não» com a marca: o interruptor ligado à vista, sem estimativa, e a ficha diz a categoria B', () => {
    const c = monta({ fisco: { estado: '', categoriaB: true } });
    const h = fisco();
    assert.equal(aVista(h, 'c_fcatb'), true);
    assert.match(h, /id="c_fcatb" checked/);
    assert.equal(app.ctSemEstimativa(c), 'catB');
    assert.equal(app.fiscoForaDoAnexoF(c), 'categoriaB', 'o mesmo que o resumo');
    assert.match(texto(app.ctAtDaFicha(c)), /Categoria B fora do Anexo F · Anexo B ou C/);
    assert.match(texto(app.ctValoresDaFicha(c)), /categoria B · sem estimativa/);
    // desligada à vista, grava-se desligada
    abre();
    domCom({ c_rent: '900', c_active: true, c_fcatb: false });
    app.collectCt();
    assert.equal(app.cForm.fisco.categoriaB, false);
  });

  test('fora de Portugal com a marca: à vista, e a ficha e o resumo dizem o mesmo anexo', () => {
    const c = monta({ fisco: { categoriaB: true } }, { pais: 'Espanha', paisCodigo: '724' });
    assert.equal(aVista(fisco(), 'c_fcatb'), true);
    assert.equal(app.ctSemEstimativa(c), 'catB');
    assert.equal(app.fiscoForaDoAnexoF(c), 'categoriaB');
    const t = texto(app.ctAtDaFicha(c));
    assert.match(t, /Declara-se no Anexo B ou C · categoria B/);
    assert.doesNotMatch(t, /Declara-se no Anexo J/);
    monta({}, { pais: 'Espanha', paisCodigo: '724' });
    assert.equal(aVista(fisco(), 'c_fcatb'), null, 'desligada, fora de Portugal não aparece');
  });
});

describe('N056 (o mesmo caso) — uma isenção guardada num «Ainda não» conta, e por isso vê-se', () => {
  test('a escolha da isenção aparece com a isenção guardada; sem ela, não', () => {
    const c = monta({ start: '2026-01-01', end: '2030-12-31', fisco: { estado: '', isencao: 'pma' } });
    assert.equal(app.irsTaxa(c, 2026).taxa, 0, 'o motor conta-a em «Ainda não»');
    const h = fisco();
    assert.equal(aVista(h, 'c_fisen'), true);
    assert.match(h, /id="c_fisen" value="pma"/);
    abre();
    domCom({ c_rent: '900', c_active: true, c_fisen: '' });
    app.collectCt();
    assert.equal(app.cForm.fisco.isencao, '', 'trocada para «Nenhuma», grava-se');
    monta({ fisco: { estado: '' } });
    assert.equal(aVista(fisco(), 'c_fisen'), null);
  });
});

describe('N126 — os encargos do inquilino e os consumos numa pergunta', () => {
  test('um contrato novo: a pergunta, e nenhum encargo à vista; os consumos numa escolha só', () => {
    monta();
    const h = corpo();
    assert.equal(aVista(h, 'c_encQ'), true);
    assert.match(h, /<b>O inquilino paga algum encargo do imóvel\?<\/b>/);
    for (const id of ['c_enc_condominio', 'c_enc_imi', 'c_enc_seguro', 'c_fconsumos']) assert.equal(aVista(h, id), false, id);
    assert.equal(aVista(h, 'c_enc_consumos'), null, 'os consumos já não são um interruptor');
    assert.equal(aVista(h, 'c_fcons'), null, 'nem se perguntam no bloco fiscal');
    assert.deepEqual(opcoes('c_fconsumos'), ['', 'inquilino', 'incluidos']);
  });

  test('só os encargos que a ficha do imóvel tem (e «Outro encargo»); sem nenhum na ficha, os três', () => {
    monta({ encargosInquilino: ['condominio'] }, { condominio: 40 });
    let h = corpo();
    assert.match(h, /id="c_encQ" checked/);
    assert.equal(aVista(h, 'c_enc_condominio'), true);
    assert.equal(aVista(h, 'c_enc_imi'), false);
    assert.match(h, /ctEncargosOutros\(\)">Outro encargo</);
    monta({ encargosInquilino: ['imi'] });
    h = corpo();
    for (const id of ['c_enc_condominio', 'c_enc_imi', 'c_enc_seguro']) assert.equal(aVista(h, id), true, id);
  });

  test('nunca se gravam os consumos do inquilino e os incluídos na renda ao mesmo tempo', () => {
    monta({ encargosInquilino: ['consumos'], fisco: { consumosIncluidos: true } });
    abre();
    assert.equal(app.ctConsumosValor(app.cForm), 'incluidos', 'o dado antigo com os dois: conta o campo 30');
    domCom({ c_rent: '900', c_active: true, c_encQ: true, c_enc_condominio: true, c_enc_imi: false, c_enc_seguro: false, c_fconsumos: 'incluidos' });
    app.collectCt();
    assert.deepEqual(copia(app.cForm.encargosInquilino), ['condominio']);
    assert.equal(app.cForm.fisco.consumosIncluidos, true);
    domCom({ c_rent: '900', c_active: true, c_encQ: true, c_enc_condominio: false, c_fconsumos: 'inquilino' });
    app.collectCt();
    assert.deepEqual(copia(app.cForm.encargosInquilino), ['consumos']);
    assert.equal(app.cForm.fisco.consumosIncluidos, false);
    domCom({ c_rent: '900', c_active: true, c_encQ: false, c_enc_condominio: true, c_fconsumos: 'incluidos' });
    app.collectCt();
    assert.deepEqual(copia(app.cForm.encargosInquilino), [], '«Não» à pergunta: nada');
    assert.equal(app.cForm.fisco.consumosIncluidos, false);
  });
});

describe('N127 — a gestão florestal marcada num imóvel que deixou de ser rústico', () => {
  test('continua à vista para se desligar, e a dica e a ficha dizem porque não conta', () => {
    const c = monta({ start: '2019-03-01', end: '2031-02-28', fisco: { finalidade: 'nh', celebracao: '2019-02-20', egf: true } }, { tipoPredio: 'U' });
    const h = fisco();
    assert.equal(aVista(h, 'c_fegf'), true);
    assert.match(h, /id="c_fegf" checked/);
    assert.match(app.ctEgfDica(app.cForm), /Atenção: em 2026 não conta/);
    assert.match(texto(app.ctAtDaFicha(c)), /Gestão florestal arrendado a uma EGF ou UGF/);
    assert.match(texto(app.ctAtDaFicha(c)), /o quadro 6C não conta em 2026/);
    monta({ fisco: { egf: false } }, { tipoPredio: 'U' });
    assert.equal(aVista(fisco(), 'c_fegf'), null, 'desligada num urbano, nada');
  });
});

describe('N130 — o imposto atrás de «Escrever outra taxa»', () => {
  test('um contrato novo em Portugal: o campo escondido, a caixa da líquida com a estimativa, e a ligação', () => {
    monta();
    const h = corpo();
    assert.equal(aVista(h, 'c_tax'), false);
    assert.equal(aVista(h, 'netBox'), true);
    domCom({ c_rent: '900', c_tax: '' });
    assert.match(app.netBox(), /Imposto \(10%, estimado: renda moderada\)/, 'a caixa da líquida diz a taxa estimada');
    assert.equal(aVista(h, 'c_taxOutraBox'), true);
    assert.match(h, /data-click="ctTaxaOutra\(\)">Escrever outra taxa</);
    const d = app.ctTaxaDica(app.cForm);
    assert.doesNotMatch(d, /pela duração|quadro 6A|não habitacional/, 'a lista das taxas do ano saiu da dica');
    assert.ok(texto(d).length < 220, 'uma dica curta: ' + texto(d).length);
  });

  test('à vista com uma taxa escrita, fora de Portugal e na categoria B', () => {
    monta({ taxRate: 25 });
    assert.equal(aVista(corpo(), 'c_tax'), true);
    monta({}, { pais: 'França', paisCodigo: '250' });
    assert.equal(aVista(corpo(), 'c_tax'), true);
    monta({ fisco: { categoriaB: true } });
    assert.equal(aVista(corpo(), 'c_tax'), true);
  });
});

describe('N153 — o que se paga à parte: em todos os de habitação, seja qual for a renda', () => {
  test('num não habitacional não aparece (salvo com valor); num de habitação de 700 € aparece', () => {
    monta({ fisco: { finalidade: 'nh' } });
    assert.equal(aVista(fisco(), 'c_fextrasQ'), false);
    monta({ rent: 700 });
    assert.equal(aVista(fisco(), 'c_fextrasQ'), true);
    monta({ fisco: { finalidade: 'dhd' } });
    assert.equal(aVista(fisco(), 'c_fextrasQ'), false);
    monta({ fisco: { finalidade: 'nh', extrasMensais: 100 } });
    const h = fisco();
    assert.equal(aVista(h, 'c_fextras'), true, 'com valor guardado fica à vista');
    assert.match(h, /id="c_fextrasQ" checked/);
  });
});

describe('N089 — a renda do contrato anterior (n.º 24) com a sua data', () => {
  test('celebrado a 20/10/2023: a pergunta do n.º 24 à vista e a do n.º 23 escondida', () => {
    monta({ start: '2023-11-01', end: '2028-10-31', rent: 2800, fisco: { celebracao: '2023-10-20' } });
    const h = fisco();
    assert.equal(aVista(h, 'c_fant'), true);
    assert.equal(aVista(h, 'c_facima'), false);
    assert.equal(app.ctN24Visivel(app.cForm), true);
    assert.equal(app.ctN23Visivel(app.cForm), false);
    monta({ start: '2024-03-01', end: '2034-02-28', rent: 2400 });
    const h2 = fisco();
    assert.equal(aVista(h2, 'c_fant'), true);
    assert.equal(aVista(h2, 'c_facima'), true);
    monta({ start: '2023-11-01', end: '2025-10-31', fisco: { celebracao: '2023-10-20' } });
    assert.equal(app.ctN24Visivel((abre(), app.cForm)), false, 'dois anos: sem redução, sem pergunta');
  });
});

describe('N096 — a dica do limite das rendas moderadas segue a letra do DL 97/2026', () => {
  test('os móveis ligados ao imóvel com carácter de permanência e os serviços que o valorizam; os móveis à parte também são renda', () => {
    const d = app.ctExtrasDica();
    assert.match(d, /ligados ao imóvel com carácter de permanência/);
    assert.match(d, /pelos serviços que o valorizam/);
    assert.match(d, /um valor anual divide-se pelos meses/);
    assert.match(d, /Na dúvida, confirma\./);
    assert.match(d, /também é renda a declarar no Anexo F \(CIRS art\. 8\.º n\.º 2/);
    assert.doesNotMatch(d, /consumos e os serviços do dia a dia/);
    assert.doesNotMatch(d, /por móveis, equipamentos e serviços, mesmo/);
    monta({ rent: 2200 });
    assert.doesNotMatch(fisco(), /Móveis e serviços pagos à parte/, 'o rótulo largo saiu');
  });
});

describe('N156 — o ex-alojamento local registado e afeto a esse fim a 31/12/2022', () => {
  test('a pergunta pede o registo e a afetação nesse dia, e as datas do contrato', () => {
    const p = app.ctAlPergunta();
    assert.match(p, /registado e afeto a esse fim, a 31\/12\/2022/);
    assert.match(p, /até 31\/12\/2024\?$|entre \d{2}\/\d{2}\/\d{4} e 31\/12\/2024\?$/);
    assert.doesNotMatch(p, /estava registado até 31\/12\/2022/);
  });
});

describe('N092 — a dica do n.º 23 diz as portarias do ano com as datas', () => {
  test('nas rendas de 2026, a Portaria 176/2019 e a 454/2026/1, cada uma com as suas datas', () => {
    const d = app.ctN23Dica();
    assert.match(d, /até 31\/08\/2026, [^;]*Portaria 176\/2019/);
    assert.match(d, /desde 14\/10\/2026, [^;]*Portaria 454\/2026\/1/);
    assert.match(d, /CIRS art\. 72\.º n\.º 23/);
    const nota = (app.irsAno(2026).taxas.limiteRendaAlta || {}).nota;
    if (nota) assert.ok(d.includes(nota), 'com a nota da versão');
    monta({ start: '2024-03-01', end: '2034-02-28', rent: 2400 });
    assert.match(fisco(), /id="c_aj_n23"/, 'no formulário, no «?» da pergunta (KAN-161)');
    assert.match(app.ctAjudaTexto('n23', app.cForm), /Portaria 454\/2026\/1/);
  });
});

describe('N029 — a categoria B não tem recibos de renda: o documento é a fatura', () => {
  test('a dica e a ficha dizem o Modelo 2 e a fatura; a ficha não pede recibos por emitir', () => {
    const d = app.ctCategoriaBDica(true);
    assert.match(d, /O contrato continua com o Modelo 2; os recibos de renda eletrónicos não se emitem \(Portaria 98-A\/2015, art\. 5\.º n\.º 1\): o documento é a fatura ou a fatura-recibo da tua atividade\./);
    assert.doesNotMatch(app.ctCategoriaBDica(), /e os recibos/);
    const c = monta({ start: '2025-03-01', end: '2035-02-28', fisco: { categoriaB: true } });
    app.db.transactions = [app.normTx({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 900, date: '2026-10-05', propertyId: 'P1', contractId: 'C1', recibo: false })];
    const t = texto(app.ctAtDaFicha(c));
    assert.doesNotMatch(t, /Recibos eletrónicos|por emitir/);
    assert.match(t, /os recibos de renda eletrónicos não se emitem/);
    assert.doesNotMatch(t, /O Modelo 2 e os recibos continuam/);
    // o mesmo contrato sem a categoria B continua a pedi-los
    app.db.contracts[0].fisco.categoriaB = false;
    assert.match(texto(app.ctAtDaFicha(app.contract('C1'))), /Recibos eletrónicos 1 de 1 por emitir em 2026/);
  });
});

describe('N093 — o arrendamento rural num prédio rústico', () => {
  test('a pergunta num rústico; com «Sim», a ficha não pede recibos; num urbano não aparece', () => {
    const c = monta({ start: '2019-03-01', end: '2031-02-28', fisco: { finalidade: 'nh' } }, { tipoPredio: 'R' });
    const h = fisco();
    assert.equal(aVista(h, 'c_frural'), true);
    assert.match(h, /É um arrendamento rural \(agrícola, florestal ou de campanha\)\?/);
    assert.deepEqual(opcoes('c_frural'), ['', '1']);
    assert.match(app.ctRuralDica(), /Portaria 98-A\/2015, art\. 5\.º n\.º 3 a\)/);
    domCom({ c_rent: '300', c_active: true, c_frural: '1' });
    app.collectCt();
    assert.equal(app.cForm.fisco.arrendamentoRural, true);
    app.db.contracts[0].fisco.arrendamentoRural = true;
    app.db.transactions = [app.normTx({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 300, date: '2026-10-05', propertyId: 'P1', contractId: 'C1', recibo: false })];
    const t = texto(app.ctAtDaFicha(c));
    assert.doesNotMatch(t, /por emitir/);
    assert.match(t, /Arrendamento rural sem recibo de renda eletrónico/);
    monta();
    assert.equal(aVista(fisco(), 'c_frural'), null);
    monta({ fisco: { arrendamentoRural: true } });
    assert.equal(aVista(fisco(), 'c_frural'), true, 'marcado num urbano: à vista para se desligar');
  });
});

describe('N025 — o «Registar recebimento» de um contrato terminado', () => {
  test('a ficha de um terminado tem o botão, que abre a receita já ligada ao contrato', () => {
    const c = monta({ start: '2024-07-01', end: '2027-06-30', active: false, fisco: { cessacao: { data: '2026-06-30', motivo: '02' } } });
    const h = app.ctValoresDaFicha(c);
    assert.match(h, /data-click="ctRegistarRecebimento\('P1','C1'\)">Registar recebimento</);
    assert.doesNotMatch(h, /ctRegistarRenda\(/, 'o «Registar renda» é dos em vigor');
    const chamadas = [];
    app.txModal = (o) => { chamadas.push(copia(o)); };
    app.ctRegistarRecebimento('P1', 'C1');
    assert.deepEqual(chamadas, [{ kind: 'income', propId: 'P1', ctId: 'C1' }]);
    // o termo passado sem renovação registada também é terminado
    monta({ start: '2023-01-01', end: '2025-12-31' });
    assert.equal(app.ctRecebimentoPossivel(app.contract('C1')), true);
    monta();
    assert.equal(app.ctRecebimentoPossivel(app.contract('C1')), false, 'um em vigor não');
    assert.doesNotMatch(app.ctValoresDaFicha(app.contract('C1')), /Registar recebimento/);
  });
});

describe('N055 — a ficha lê a dispensa dos recibos da situação fiscal do ano', () => {
  test('a dispensa ligada no cartão do ano chega à ficha; a de topo desligada no ano deixa de valer', () => {
    const c = monta({ start: '2025-03-01', end: '2030-02-28' });
    app.db.transactions = [app.normTx({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 900, date: '2026-10-05', propertyId: 'P1', contractId: 'C1', recibo: false })];
    app.db.settings.irs = { dispensaRecibos: false, porAno: { 2026: { dispensaRecibos: true } } };
    assert.match(texto(app.ctAtDaFicha(c)), /Recibos eletrónicos dispensado · Modelo 44/);
    app.db.settings.irs = { dispensaRecibos: true, porAno: { 2026: { dispensaRecibos: false } } };
    assert.match(texto(app.ctAtDaFicha(c)), /Recibos eletrónicos 1 de 1 por emitir em 2026/);
  });
});

describe('o caminho para uma pergunta dentro de uma caixa fechada', () => {
  test('ctAbreCaixaDe liga a pergunta da particularidade e mostra a caixa', () => {
    monta({ fisco: { isencao: 'prerau' } });
    abre();
    const els = domCom({ c_rent: '900', c_fpart: false, c_fpartBox: '' });
    els.c_fpartBox = app.document.getElementById('c_fpartBox');
    els.c_fpartBox.hidden = true;
    app.ctAbreCaixaDe('c_fnrau');
    assert.equal(app.document.getElementById('c_fpart').checked, true);
    assert.equal(els.c_fpartBox.hidden, false);
  });
});

describe('KAN-161 — cada pergunta do bloco fiscal com um «?» que explica; por baixo só o caso', () => {
  test('o «?» fica fora do rótulo, com o nome «Explicar: …», e as explicações saem de baixo das perguntas', () => {
    monta({ start: '2024-03-01', end: '2034-02-28', rent: 2400 });
    const h = fisco();
    const re = /<button type="button" class="ct-ajuda" id="c_aj_([a-z0-9]+)"[^>]*>/g;
    let m, n = 0;
    while ((m = re.exec(h))) {
      n++;
      const antes = h.slice(0, m.index);
      assert.ok(antes.lastIndexOf('<label') < antes.lastIndexOf('</label>'), m[1] + ': o «?» não está dentro de um <label>');
      assert.match(m[0], /aria-label="Explicar: [^"]+"/, m[1]);
      assert.match(m[0], new RegExp('data-toca="camada" data-click="ctExplicar\\(\'' + m[1] + '\'\\)"'), m[1]);
    }
    assert.ok(n >= 8, 'há «?» em todas as perguntas que explicam: ' + n);
    for (const k of ['num', 'cel', 'extras', 'isen', 'catb', 'n23', 'n24']) assert.match(h, new RegExp('id="c_aj_' + k + '"'), k);
    /* o texto à vista já não traz a lei nem os anexos de cada pergunta */
    const t = texto(h);
    for (const lei of [/Vem no comprovativo do Modelo 2/, /DL 97\/2026/, /CIRS art\. 4\.º/, /Portaria 176\/2019/, /O dia em que assinaram/, /Há isenções de IRS/])
      assert.doesNotMatch(t, lei, String(lei));
  });

  test('o «?» abre uma janela por cima do formulário com o texto do momento do toque', () => {
    monta({ start: '2024-03-01', end: '2034-02-28', rent: 2400 });
    abre();
    const abertas = [];
    app.openModal = (t, b, f) => { abertas.push({ t, b: String(b), f: String(f) }); return { gatilho: null }; };
    /* a finalidade escolhida agora no formulário (ainda por gravar) é o DHD */
    domCom({ c_rent: '2400', c_start: '2024-03-01', c_end: '2034-02-28', c_ffin: 'dhd' });
    app.ctExplicar('fin');
    assert.equal(abertas.length, 1);
    assert.equal(abertas[0].t, 'Finalidade');
    assert.match(abertas[0].b, /^<p class="ct-explica">O direito real de habitação duradoura \(DL 1\/2020\) vai ao quadro 4\.3/);
    assert.match(abertas[0].f, /<button type="button" class="btn primary" data-toca="camada" data-click="closeModal\(\)">Fechar<\/button>/, 'só de leitura: um botão, Fechar');
    /* noutra finalidade não há explicação, e nada abre */
    domCom({ c_rent: '2400', c_start: '2024-03-01', c_end: '2034-02-28', c_ffin: 'hp' });
    app.ctExplicar('fin');
    assert.equal(abertas.length, 1);
    /* a categoria B ligada agora diz o que muda; desligada, quem a liga */
    domCom({ c_rent: '2400', c_fpart: true, c_fcatb: true });
    app.ctExplicar('catb');
    assert.match(abertas[1].b, /As rendas deste contrato saem do Anexo F/);
    domCom({ c_rent: '2400', c_fpart: true, c_fcatb: false });
    app.ctExplicar('catb');
    assert.match(abertas[2].b, /Só com atividade aberta/);
    assert.equal(abertas[2].t, 'Rendas na categoria B');
    app.ctExplicar('inventada');
    assert.equal(abertas.length, 3, 'uma chave que não existe não abre nada');
  });

  test('a frase curta só quando há caso', () => {
    /* o n.º: só num contrato de antes de abril de 2015 */
    monta({ start: '2012-05-01', end: '' });
    abre();
    assert.equal(app.ctNumeroCaso(app.cForm), 'Começou antes de abril de 2015: não tem Modelo 2.');
    monta();
    abre();
    assert.equal(app.ctNumeroCaso(app.cForm), '');
    /* a isenção: só quando não conta */
    monta({ start: '2026-11-01', end: '2029-10-31', fisco: { celebracao: '2026-10-20', isencao: 'paa' } });
    abre();
    assert.match(app.ctIsencaoCaso('paa', app.cForm), /^Atenção: a isenção só vale para contratos celebrados até 31\/08\/2026\.$/);
    monta({ start: '2026-01-01', end: '2030-12-31', fisco: { celebracao: '2025-12-20', isencao: 'paa' } });
    abre();
    assert.equal(app.ctIsencaoCaso('paa', app.cForm), '', 'a isenção conta: nada por baixo');
    assert.equal(app.ctIsencaoCaso('', app.cForm), '');
    /* a celebração: só depois do início */
    assert.equal(app.ctCelebracaoCaso(app.normContract({ start: '2026-01-01', fisco: { celebracao: '2025-12-20' } })), '');
    assert.equal(app.ctCelebracaoCaso(app.normContract({ start: '2026-01-01', fisco: { celebracao: '' } })), '');
    assert.match(app.ctCelebracaoCaso(app.normContract({ start: '2026-01-01', fisco: { celebracao: '2026-02-03' } })), /depois do início \(01\/01\/2026\)/);
    /* «Ainda não»: o prazo do Modelo 2; fora de Portugal, nada */
    monta({ fisco: { estado: '' } });
    abre();
    assert.equal(app.ctPorIndicarCaso(app.cForm), 'O prazo é 31/12/2026, o fim do mês seguinte ao início.');
    monta({ fisco: { estado: '' } }, { pais: 'França', paisCodigo: '250' });
    abre();
    assert.equal(app.ctPorIndicarCaso(app.cForm), '');
  });
});
