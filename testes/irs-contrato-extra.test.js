// O IRS do lado do contrato e da taxa, para lá do básico: a comunicação de
// fevereiro marcada como feita (e o aviso que se cala), os n.os 23 e 24 do
// art. 72.º do CIRS (a renda acima de 150 % do limite tira a redução; a renda
// mais baixa do que a do contrato anterior dá mais 5 pontos), as isenções dos
// programas de arrendamento acessível (PAA, RSAA, PMA, PMAE) com o prazo do
// IHRU, a renovação registada em vez de mudar só o fim, e o Modelo 44 de quem
// está dispensado do recibo eletrónico.
//
// O dia da app é fixo (2026-10-08): o ano corrente é 2026 e o anterior 2025.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-10-08' });
afterEach(() => repor(app));

const copia = (x) => JSON.parse(JSON.stringify(x));
const ct = (extra) => app.normContract(Object.assign({ rent: 2500, fisco: { estado: 'declarado', finalidade: 'hp' } }, extra));

/* um imóvel de arrendamento, um dono, uma inquilina e um contrato
   Recebe: extra (opcional) — campos do contrato (o fisco por inteiro, se vier).
   Devolve: o contrato guardado em db.contracts. */
function monta(extra) {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Rui' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'] })];
  app.db.contracts = [app.normContract(Object.assign({ id: 'C1', name: 'Ana · T2', propertyId: 'P1', tenantIds: ['T1'], rent: 2500,
    start: '2025-01-01', end: '2029-12-31', fisco: { estado: 'declarado', finalidade: 'hp' } }, extra || {}))];
  app.db.transactions = [];
  app.db.settings.prazosVistos = {};
  app.foldState = {};
  return app.db.contracts[0];
}

/* uma renda recebida do contrato C1
   Recebe: id — o id do movimento; date — 'AAAA-MM-DD'.
   Devolve: nada — junta-a a db.transactions. */
function renda(id, date) {
  app.db.transactions.push(app.normTx({ id, kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 2500, date,
    propertyId: 'P1', contractId: 'C1' }));
}

/* um DOM que só conhece os ids do mapa (o resto não está no ecrã)
   Recebe: valores — {id: valor}; true é uma caixa marcada.
   Devolve: nada — o repor devolve o getElementById do arnês. */
function domCom(valores) {
  app.document.getElementById = (id) => (id in valores
    ? { value: valores[id] === true ? 'on' : String(valores[id]), checked: valores[id] === true, hidden: false, textContent: '', innerHTML: '',
        classList: { add() {}, remove() {} }, addEventListener() {}, focus() {}, scrollIntoView() {} }
    : null);
}

/* as janelas e o ecrã ficam de fora: guarda-se o que se abriu e o que se disse
   Devolve: {abertas, avisos} — os títulos das janelas abertas e os toasts. */
function semEcra() {
  const o = { abertas: [], avisos: [] };
  app.openModal = (titulo) => { o.abertas.push(titulo); return {}; };
  app.closeModal = () => {};
  app.closeAllModals = () => {};
  app.render = () => {};
  app.buildNav = () => {};
  app.toast = (m) => { o.avisos.push(m); };
  return o;
}

describe('o bloco fiscal guarda as peças novas', () => {
  beforeEach(() => limpar(app));

  test('as comunicações: só anos de quatro dígitos e datas que existem', () => {
    const f = app.normFisco({ comunicacoes: { 2025: '2026-02-10', '26': '2026-02-10', 2024: '2025-02-30', 2023: '10/02/2024', x: '2026-01-01' } });
    igual(f.comunicacoes, { 2025: '2026-02-10' });
    igual(app.normFisco({ comunicacoes: ['2026-02-10'] }).comunicacoes, {});
    igual(app.normFisco(null).comunicacoes, {});
  });

  test('a renda acima do limite é true, false ou por indicar; a renda anterior é um número ≥ 0; a isenção é uma das cinco', () => {
    assert.equal(app.normFisco({ rendaAcimaDoLimite: true }).rendaAcimaDoLimite, true);
    assert.equal(app.normFisco({ rendaAcimaDoLimite: false }).rendaAcimaDoLimite, false);
    assert.equal(app.normFisco({ rendaAcimaDoLimite: 'sim' }).rendaAcimaDoLimite, null);
    assert.equal(app.normFisco({ rendaAnterior: '900' }).rendaAnterior, 900);
    assert.equal(app.normFisco({ rendaAnterior: -5 }).rendaAnterior, 0);
    assert.equal(app.normFisco({ rendaAnterior: 'abc' }).rendaAnterior, 0);
    for (const v of ['', 'paa', 'rsaa', 'pma', 'pmae']) assert.equal(app.normFisco({ isencao: v }).isencao, v);
    assert.equal(app.normFisco({ isencao: 'al' }).isencao, '');
  });

  test('irsComunicado dá a data do ano, ou vazio', () => {
    const c = ct({ fisco: { comunicacoes: { 2025: '2026-02-10' } } });
    assert.equal(app.irsComunicado(c, 2025), '2026-02-10');
    assert.equal(app.irsComunicado(c, '2025'), '2026-02-10');
    assert.equal(app.irsComunicado(c, 2026), '');
    assert.equal(app.irsComunicado(null, 2025), '');
  });
});

describe('a comunicação de fevereiro marcada', () => {
  beforeEach(() => { monta(); renda('R1', '2025-05-08'); });

  test('com a comunicação do ano marcada, o aviso do 15 de fevereiro desse ano cala-se', () => {
    assert.ok(app.prazosDe('2026-01-10').some((p) => p.tipo === 'fev15'), 'cinco anos, rendas em 2025: avisa');
    app.db.contracts[0].fisco.comunicacoes = { 2024: '2025-02-01' };
    assert.ok(app.prazosDe('2026-01-10').some((p) => p.tipo === 'fev15'), 'a de outro ano não conta');
    app.db.contracts[0].fisco.comunicacoes = { 2025: '2026-01-05' };
    assert.ok(!app.prazosDe('2026-01-10').some((p) => p.tipo === 'fev15'));
  });

  test('a ficha diz o ano em causa e marca e desmarca pelo caminho de gravar', () => {
    const o = semEcra();
    let html = app.ctFicha('C1');
    assert.match(html, /Duração e renovações de 2025 por comunicar no Portal das Finanças: o prazo era 15\/02\/2026\./);
    assert.match(html, /ctComunicadaPergunta\('C1',2025\)/, 'marcar pergunta o dia');
    assert.match(html, />Marcar como comunicada</);
    app.ctComunicadaPergunta('C1', 2025);
    assert.deepEqual(o.abertas, ['Comunicação de 2025']);
    domCom({ c_comdia: '2026-02-10' });
    app.ctMarcarComunicada('C1', 2025, 1);
    assert.equal(app.irsComunicado(app.contract('C1'), 2025), '2026-02-10', 'marcada com o dia que a pessoa disse');
    assert.match(o.avisos.join(' '), /Comunicação de 2025 marcada como feita\./);
    html = app.ctFicha('C1');
    assert.match(html, /Duração e renovações de 2026 por comunicar no Portal das Finanças: até 15\/02\/2027\./, 'passado o prazo de 2025, marcada, passa ao ano corrente');
    app.ctMarcarComunicada('C1', 2025, 0);
    assert.equal(app.irsComunicado(app.contract('C1'), 2025), '');
    domCom({ c_comdia: '2026-12-01' });
    app.ctMarcarComunicada('C1', 2025, 1);
    assert.equal(app.irsComunicado(app.contract('C1'), 2025), '', 'um dia depois de hoje não se grava');
    domCom({});
    assert.ok(!/\d{4}-\d{2}-\d{2}/.test(app.ctFicha('C1').replace(/data-[a-z]+="[^"]*"/g, '')), 'nenhuma data ISO no ecrã');
  });

  test('antes do prazo, a marcada fica à vista com «Desmarcar»', () => {
    app.db.contracts[0].fisco.comunicacoes = { 2025: '2026-01-05' };
    assert.equal(app.ctAnoComunicacao(app.contract('C1'), '2026-02-01'), 2025);
    assert.equal(app.ctAnoComunicacao(app.contract('C1'), '2026-03-01'), 2026);
    const c = ct({ start: '2025-01-01', end: '2026-12-31' });
    assert.equal(app.ctAnoComunicacao(c, '2026-02-01'), null, 'dois anos: sem redução, nada a comunicar');
  });

  test('um ano em que o contrato não existia não tem nada a comunicar', () => {
    const novo = ct({ start: '2026-03-01', end: '2031-02-28' });
    assert.equal(app.ctAnoComunicacao(novo, '2026-10-08'), 2026, 'começou em 2026: é o de 2026, e não o de 2025');
    const acabou = ct({ start: '2015-01-01', end: '2024-12-31', fisco: { estado: 'declarado', finalidade: 'hp', renovacoes: [{ inicio: '2020-01-01', fim: '2024-12-31' }] } });
    assert.equal(app.ctAnoComunicacao(acabou, '2026-10-08'), null, 'acabou em 2024');
  });
});

describe('o art. 72.º n.º 23: renda acima de 150 % do limite', () => {
  test('celebrado desde 2024 e marcado acima do limite: sem redução, vai ao 4.1', () => {
    const base = { start: '2024-03-01', end: '2029-02-28' };
    assert.equal(app.irsRate(ct(base), 2025), 15);
    const acima = ct(Object.assign({}, base, { fisco: { estado: 'declarado', finalidade: 'hp', rendaAcimaDoLimite: true } }));
    assert.equal(app.irsReducao(acima, 2025), null);
    assert.equal(app.irsRate(acima, 2025), 25);
    assert.equal(app.irsRate(ct(Object.assign({}, base, { fisco: { finalidade: 'hp', rendaAcimaDoLimite: false } })), 2025), 15);
    assert.equal(app.irsRate(ct(Object.assign({}, base, { fisco: { finalidade: 'hp', rendaAcimaDoLimite: null } })), 2025), 15, 'por indicar conta a redução');
  });

  test('antes de 2024 não se aplica; a celebração escrita manda sobre o início', () => {
    assert.equal(app.irsRate(ct({ start: '2023-12-01', end: '2028-11-30', fisco: { finalidade: 'hp', rendaAcimaDoLimite: true } }), 2025), 15);
    assert.equal(app.irsRate(ct({ start: '2024-01-15', end: '2029-01-14', fisco: { finalidade: 'hp', celebracao: '2023-12-20', rendaAcimaDoLimite: true } }), 2025), 15);
  });

  test('os parâmetros vivem na versão do ano', () => {
    for (const a of [2025, 2026]) igual(app.irsAno(a).taxas.limiteRendaAlta, { desde: '2024-01-01', percentagem: 150 });
  });
});

describe('o art. 72.º n.º 24: renda mais baixa do que a do contrato anterior', () => {
  const com = (rent, ant, extra) => ct(Object.assign({ rent, start: '2024-03-01', end: '2029-02-28', fisco: { finalidade: 'hp', rendaAnterior: ant } }, extra || {}));

  test('pelo menos 5 % abaixo: −5 pontos, e diz-se (quadro 4.2B)', () => {
    const r = copia(app.irsReducao(com(2850, 3000), 2025));
    assert.equal(r.taxa, 10); assert.equal(r.bonus, true);
    const r2 = copia(app.irsReducao(com(2851, 3000), 2025));
    assert.equal(r2.taxa, 15); assert.equal(r2.bonus, false, 'menos de 5 % abaixo não chega');
    assert.equal(copia(app.irsReducao(com(2500, 0), 2025)).bonus, false, '0 é «não se aplica»');
  });

  test('nunca abaixo do mínimo, só no período inicial, e só nos celebrados desde 2024', () => {
    const vinte = copia(app.irsReducao(com(2000, 3000, { end: '2044-02-29' }), 2025));
    assert.equal(vinte.taxa, 5); assert.equal(vinte.bonus, false, 'vinte anos já estão no mínimo');
    const renovado = com(2000, 3000, { end: '2034-02-28', fisco: { finalidade: 'hp', rendaAnterior: 3000, renovacoes: [{ inicio: '2029-03-01', fim: '2034-02-28' }] } });
    assert.equal(copia(app.irsReducao(renovado, 2025)).bonus, true, 'em 2025 ainda é o contrato inicial');
    assert.equal(copia(app.irsReducao(renovado, 2030)).bonus, false, 'a renovação não é um contrato novo');
    assert.equal(copia(app.irsReducao(com(2000, 3000, { start: '2023-11-01', end: '2028-10-31' }), 2025)).bonus, false);
  });

  test('em 2026 a taxa final é a mais baixa entre a duração com o bónus e os 10 %', () => {
    const t = copia(app.irsTaxa(com(2400, 3000, { start: '2026-01-01', end: '2045-12-31' }), 2026));
    assert.equal(t.taxa, 5, 'vinte anos ganham aos 10 %');
    const t2 = copia(app.irsTaxa(com(2400, 3000, { start: '2026-01-01', end: '2035-12-31' }), 2026));
    assert.equal(t2.taxa, 5); assert.equal(t2.motivo, 'duracao'); assert.equal(t2.reducao.bonus, true, 'dez anos: 10 − 5');
  });

  test('o formulário só pergunta quando conta, e a ficha diz o bónus', () => {
    monta({ start: '2024-03-01', end: '2034-02-29', rent: 2400, fisco: { estado: 'declarado', finalidade: 'hp', rendaAnterior: 3000 } });
    app.cForm = app.normContract(copia(app.contract('C1')));
    let html = app.fiscoSect();
    assert.match(html, /<div id="c_fn23">/, 'à vista');
    assert.match(html, /Renda acima de 150 % do limite do concelho\?/);
    assert.match(html, /desde 01\/01\/2024/);
    assert.match(html, /id="c_fant"[^>]*value="3000"/);
    assert.ok(app.ctN23Visivel(app.cForm));
    app.cForm = app.normContract({ propertyId: 'P1', tenantIds: ['T1'], rent: 2400, start: '2023-11-01', end: '2033-10-31', fisco: { estado: 'declarado', finalidade: 'hp' } });
    assert.match(app.fiscoSect(), /<div id="c_fn23" hidden>/, 'celebrado antes de 2024: escondida');
    app.cForm = app.normContract({ propertyId: 'P1', tenantIds: ['T1'], rent: 2400, start: '2025-01-01', end: '2026-12-31', fisco: { estado: 'declarado', finalidade: 'hp' } });
    assert.ok(!app.ctN23Visivel(app.cForm), 'dois anos: sem redução possível');
    assert.match(app.ctFicha('C1'), /já com os 5 pontos a menos de uma renda mais baixa do que a do contrato anterior \(quadro 4\.2B\)/);
  });

  test('o collectCt lê as duas perguntas', () => {
    monta({ start: '2024-03-01', end: '2034-02-29' });
    app.cForm = app.normContract(copia(app.contract('C1')));
    domCom({ c_rent: '2400', c_start: '2024-03-01', c_end: '2034-02-29', c_active: true, c_facima: '1', c_fant: '2 900,50', c_fisen: '' });
    app.collectCt();
    assert.equal(app.cForm.fisco.rendaAcimaDoLimite, true);
    assert.equal(app.cForm.fisco.rendaAnterior, 2900.5);
    domCom({ c_rent: '2400', c_start: '2024-03-01', c_end: '2034-02-29', c_active: true, c_facima: '', c_fant: '' });
    app.collectCt();
    assert.equal(app.cForm.fisco.rendaAcimaDoLimite, null);
    assert.equal(app.cForm.fisco.rendaAnterior, 0);
  });
});

describe('as isenções (quadro 6D)', () => {
  test('os códigos da versão: 01 PAA, 02 PMA, 03 PMAE; o RSAA só desde 2026, com o código por conhecer', () => {
    const cod = (a) => Object.fromEntries(copia(app.irsAno(a).isencoes).map((x) => [x.id, x.codigo]));
    igual(cod(2025), { paa: '01', pma: '02', pmae: '03' });
    igual(cod(2026), { paa: '01', rsaa: '', pma: '02', pmae: '03' });
    copia(app.irsAno(2026).isencoes).forEach((x) => {
      assert.equal(x.quadro, '6D');
      assert.ok(x.nome && x.texto.length > 40, x.id);
      assert.doesNotMatch(x.texto, /\d{4}-\d{2}-\d{2}/, 'datas por extenso no texto que se mostra');
    });
  });

  test('um contrato isento paga 0 %, «isento», e sai do 4.2', () => {
    const c = ct({ start: '2024-01-01', end: '2033-12-31', fisco: { estado: 'declarado', finalidade: 'hp', isencao: 'pma' } });
    const t = copia(app.irsTaxa(c, 2025));
    assert.equal(t.taxa, 0); assert.equal(t.motivo, 'isento'); assert.equal(t.reducao, null);
    assert.equal(t.isencao.codigo, '02');
    assert.equal(app.irsTaxaPorque(c, 2025), 'isento');
    assert.equal(app.irsRate(ct({ fisco: { finalidade: 'nh', isencao: 'paa' } }), 2025), 0, 'a isenção vem antes da finalidade');
  });

  test('o RSAA não isenta as rendas de 2025 (não existia), e isenta as de 2026', () => {
    const c = ct({ start: '2026-09-15', end: '2029-09-14', fisco: { finalidade: 'hp', isencao: 'rsaa' } });
    assert.equal(app.irsTaxa(c, 2025).motivo, 'base');
    assert.equal(app.irsRate(c, 2026), 0);
    assert.equal(app.irsRate(c, 2027), 0, 'a versão de 2026 serve 2027');
  });

  test('o formulário oferece a escolha com a explicação curta', () => {
    monta({ fisco: { estado: 'declarado', finalidade: 'hp', isencao: 'pmae' } });
    app.cForm = app.normContract(copia(app.contract('C1')));
    const html = app.fiscoSect();
    assert.match(html, /Isenção de IRS/);
    assert.match(html, /id="c_fisen" value="pmae"/);
    assert.match(html, /alojamento para estudantes[^<]*quadro 6D do Anexo F \(código 03\)/);
    assert.match(app.ctIsencaoTexto('rsaa'), /o código ainda não se conhece/);
    assert.match(app.ctIsencaoTexto(''), /taxa estimada passa a 0 %/);
    assert.match(app.ctFicha('C1'), /Isento de IRS: Programa municipal de alojamento estudantil \(PMAE\)\. As rendas declaram-se na linha do quadro 4\.1 do Anexo F, sem imposto, e o quadro 6D aponta para ela \(código 03\)/);
  });

  test('RSAA: o envio ao IHRU até 15 de janeiro do ano seguinte à celebração', () => {
    monta({ start: '2026-10-01', end: '2029-09-30', fisco: { estado: 'declarado', finalidade: 'hp', isencao: 'rsaa', celebracao: '2026-09-20' } });
    assert.ok(!app.prazosDe('2026-10-08').some((p) => p.tipo === 'rsaa'), 'a 99 dias ainda não');
    const p = app.prazosDe('2026-12-10').find((x) => x.tipo === 'rsaa');
    assert.ok(p, 'a 36 dias avisa');
    assert.equal(p.alvo, '2027-01-15');
    assert.match(p.sub, /Até 15\/01\/2027/);
    assert.match(p.titulo, /Enviar o contrato ao IHRU \(RSAA\)/);
    assert.ok(!app.prazosDe('2027-01-20').some((x) => x.tipo === 'rsaa'), 'passado o dia não há o que fazer');
    app.db.contracts[0].fisco.estado = '';
    assert.ok(app.prazosDe('2026-12-10').some((x) => x.tipo === 'rsaa'), 'por indicar também');
    app.db.contracts[0].fisco.estado = 'naoDeclarado';
    assert.ok(!app.prazosDe('2026-12-10').some((x) => x.tipo === 'rsaa'), 'não declarado: nada');
    app.db.contracts[0].fisco.estado = 'declarado';
    app.db.contracts[0].fisco.celebracao = '2026-08-20';
    assert.ok(!app.prazosDe('2026-12-10').some((x) => x.tipo === 'rsaa'), 'antes do regime: não');
  });
});

describe('renovar em vez de mudar o fim', () => {
  test('o contrato inicial acaba na véspera da primeira renovação, mesmo com o fim levado para a frente', () => {
    const c = ct({ start: '2024-01-01', end: '2033-12-31', fisco: { finalidade: 'hp', renovacoes: [{ inicio: '2029-01-01', fim: '2033-12-31' }] } });
    igual(app.irsPeriodos(c), [{ inicio: '2024-01-01', fim: '2028-12-31' }, { inicio: '2029-01-01', fim: '2033-12-31' }]);
    assert.equal(app.irsRate(c, 2025), 15, 'cinco anos, e não dez');
    assert.equal(app.irsRate(c, 2030), 13, 'a renovação de igual duração desce 2 pontos');
  });

  test('a sugestão repete a duração do período que acaba', () => {
    assert.equal(app.ctRenovacaoSugerida(ct({ start: '2025-03-01', end: '2026-02-28' })), '2027-02-28');
    assert.equal(app.ctRenovacaoSugerida(ct({ start: '2021-03-01', end: '2026-02-28', fisco: { renovacoes: [{ inicio: '2024-03-01', fim: '2026-02-28' }] } })), '2028-02-29', 'a última renovação: dois anos');
    assert.equal(app.ctRenovacaoSugerida(ct({ start: '2026-01-31', end: '2026-02-09' })), '2026-02-19', 'sem um mês inteiro, em dias');
    assert.equal(app.ctSomaMeses('2026-01-31', 1), '2026-02-28');
    assert.equal(app.ctRenovacaoSugerida(ct({ start: '2025-03-01', end: '' })), '');
  });

  test('«Renovar…» regista a renovação, leva o fim e acerta o planeado da renda', () => {
    monta({ start: '2025-03-01', end: '2026-12-31' });
    const o = semEcra();
    app.syncContractRec(app.contract('C1'));
    app.ctRenovar('C1');
    assert.ok(o.abertas.includes('Renovar contrato'));
    domCom({ c_renfim: '2026-12-31' });
    app.ctRenovarOk('C1');
    assert.equal(app.contract('C1').end, '2026-12-31', 'um fim que não anda para a frente não se grava');
    domCom({ c_renfim: '2028-12-31' });
    app.ctRenovarOk('C1');
    const c = app.contract('C1');
    assert.equal(c.end, '2028-12-31');
    assert.equal(c.fisco.renovacoes.length, 1);
    assert.equal(c.fisco.renovacoes[0].inicio, '2027-01-01');
    assert.equal(c.fisco.renovacoes[0].fim, '2028-12-31');
    assert.ok(c.fisco.renovacoes[0].id);
    const rec = app.db.recurring.find((r) => r.auto && r.tx && r.tx.contractId === 'C1');
    assert.equal(rec.end, '2028-12-31', 'o planeado segue o fim novo');
    assert.match(o.avisos.join(' '), /Renovação registada: o contrato vai até 31\/12\/2028\./);
  });

  test('o menu da ficha oferece «Renovar…» só a um contrato com fim, em vigor', () => {
    let itens = [];
    monta({ end: '2026-12-31' });
    semEcra();
    app.abrirFicha = (o) => { itens = String(o.menu()); };
    app.ctView('C1');
    assert.match(itens, /Renovar…/);
    assert.match(itens, /ctRenovar\(&#39;C1&#39;\)|ctRenovar\('C1'\)/);
    app.contract('C1').end = '';
    app.ctView('C1');
    assert.doesNotMatch(itens, /Renovar…/);
  });

  test('no formulário, levar o fim para a frente pergunta: renovação ou correção', () => {
    for (const resposta of [1, 0]) {
      monta({ start: '2025-03-01', end: '2026-02-28' });
      const o = semEcra();
      app.cForm = app.normContract(copia(app.contract('C1')));
      domCom({ c_rent: '2500', c_start: '2025-03-01', c_end: '2027-02-28', c_active: true });
      app.ctSaver()();
      assert.deepEqual(o.abertas, ['Renovação ou correção?']);
      assert.equal(app.contract('C1').end, '2026-02-28', 'nada se grava antes da resposta');
      app.ctFimResposta(resposta);
      const c = app.contract('C1');
      assert.equal(c.end, '2027-02-28');
      if (resposta) igual(c.fisco.renovacoes.map((r) => [r.inicio, r.fim]), [['2026-03-01', '2027-02-28']]);
      else assert.equal(c.fisco.renovacoes.length, 0, 'uma correção não inventa renovações');
    }
  });

  test('sem pergunta quando o fim encurta, quando não havia fim, ou quando a renovação já foi escrita', () => {
    monta({ start: '2025-03-01', end: '2026-02-28' });
    let o = semEcra();
    app.cForm = app.normContract(copia(app.contract('C1')));
    domCom({ c_rent: '2500', c_start: '2025-03-01', c_end: '2026-01-31', c_active: true });
    app.ctSaver()();
    assert.deepEqual(o.abertas, []);
    assert.equal(app.contract('C1').end, '2026-01-31');
    monta({ start: '2025-03-01', end: '' });
    o = semEcra();
    app.cForm = app.normContract(copia(app.contract('C1')));
    domCom({ c_rent: '2500', c_start: '2025-03-01', c_end: '2027-02-28', c_active: true });
    app.ctSaver()();
    assert.deepEqual(o.abertas, []);
    monta({ start: '2025-03-01', end: '2026-02-28', fisco: { estado: 'declarado', renovacoes: [{ id: 'R1', inicio: '2026-03-01', fim: '2027-02-28' }] } });
    o = semEcra();
    app.cForm = app.normContract(copia(app.contract('C1')));
    domCom({ c_rent: '2500', c_start: '2025-03-01', c_end: '2027-02-28', c_active: true, c_rini_R1: '2026-03-01', c_rfim_R1: '2027-02-28' });
    app.ctSaver()();
    assert.deepEqual(o.abertas, []);
    assert.equal(app.contract('C1').fisco.renovacoes.length, 1);
  });
});

describe('o Modelo 44 de quem está dispensado do recibo eletrónico', () => {
  beforeEach(() => { monta({ fisco: { estado: 'declarado', finalidade: 'nh' } }); });

  test('sem a escolha (nem db.settings.irs), não há Modelo 44', () => {
    renda('R1', '2025-12-01');
    delete app.db.settings.irs;
    assert.ok(!app.prazosDe('2026-02-01').some((p) => p.tipo === 'modelo44'));
    app.db.settings.irs = { dispensaRecibos: false };
    assert.ok(!app.prazosDe('2026-02-01').some((p) => p.tipo === 'modelo44'));
  });

  test('com ela e rendas no ano anterior: até ao fim de fevereiro (desde o DL 49/2025)', () => {
    renda('R1', '2025-12-01');
    app.db.settings.irs = { dispensaRecibos: true };
    const p = app.prazosDe('2026-02-01').find((x) => x.tipo === 'modelo44');
    assert.ok(p);
    assert.equal(p.alvo, '2026-02-28');
    assert.match(p.titulo, /Modelo 44 — as rendas de 2025/);
    assert.match(p.sub, /até 28\/02\/2026/);
    assert.ok(app.prazosDe('2026-03-10').some((x) => x.tipo === 'modelo44'), 'passado o dia continua: entrega-se na mesma');
    assert.ok(!app.prazosDe('2025-12-01').some((x) => x.tipo === 'modelo44'), 'sem rendas em 2024, nada');
  });

  test('antes do DL 49/2025 era até ao fim de janeiro; num ano bissexto, 29 de fevereiro', () => {
    app.db.settings.irs = { dispensaRecibos: true };
    renda('R1', '2024-06-01');
    assert.equal(app.prazosDe('2025-01-10').find((x) => x.tipo === 'modelo44').alvo, '2025-01-31');
    renda('R2', '2027-06-01');
    assert.equal(app.prazosDe('2028-02-01').find((x) => x.tipo === 'modelo44').alvo, '2028-02-29');
  });

  test('dispensado do recibo eletrónico, não há recibos por emitir', () => {
    renda('R1', '2026-09-01');
    assert.ok(app.prazosDe('2026-10-08').some((p) => p.tipo === 'recibos'));
    app.db.settings.irs = { dispensaRecibos: true };
    assert.ok(!app.prazosDe('2026-10-08').some((p) => p.tipo === 'recibos'));
  });
});

describe('o que a revisão apanhou', () => {
  beforeEach(() => { monta(); });

  test('o RSAA só isenta os contratos celebrados desde 1/9/2026', () => {
    const antes = ct({ start: '2026-03-01', end: '2029-02-28', fisco: { estado: 'declarado', finalidade: 'hp', celebracao: '2026-02-20', isencao: 'rsaa' } });
    assert.equal(app.irsIsencao(antes, 2026), null);
    assert.notEqual(app.irsTaxa(antes, 2026).motivo, 'isento');
    const depois = ct({ start: '2026-10-01', end: '2029-09-30', fisco: { estado: 'declarado', finalidade: 'hp', celebracao: '2026-09-15', isencao: 'rsaa' } });
    assert.equal(app.irsTaxa(depois, 2026).motivo, 'isento');
  });

  test('«Renovar…» com uma renovação já escrita à mão para lá do fim parte do fim dela, e não a repete', () => {
    const o = semEcra();
    const c = app.db.contracts[0];
    c.start = '2020-01-01'; c.end = '2024-12-31';
    c.fisco = app.normFisco({ estado: 'declarado', finalidade: 'hp', renovacoes: [{ id: 'R1', inicio: '2025-01-01', fim: '2029-12-31' }] });
    assert.equal(app.ctFimEfetivo(c), '2029-12-31');
    assert.equal(app.ctRenovacaoSugerida(c), '2034-12-31', 'mais cinco anos depois da renovação');
    const antes = app.irsReducao(c, 2026).taxa;
    domCom({ c_renfim: '2029-12-31' });
    app.ctRenovarOk('C1');
    assert.equal(app.fiscoDe(c).renovacoes.length, 1, 'a mesma renovação não se escreve outra vez');
    assert.equal(app.irsReducao(c, 2026).taxa, antes, 'e a taxa não desce');
    domCom({ c_renfim: '2034-12-31' });
    app.ctRenovarOk('C1');
    assert.deepEqual(app.fiscoDe(c).renovacoes.map((r) => r.inicio), ['2025-01-01', '2030-01-01']);
    assert.equal(c.end, '2034-12-31');
    assert.ok(o.avisos.some((t) => /Renovação registada/.test(t)));
  });
});
