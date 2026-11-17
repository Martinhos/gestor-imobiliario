// O ciclo de um contrato perante o IRS, do lado do contrato: terminar com o dia
// em que acabou e o motivo do quadro 10 (o termo nunca muda), reativar sem
// apagar o termo, encurtar o fim à mão de um contrato com redução, a renovação
// escrita à mão que leva o fim, o início obrigatório, o imóvel vendido fora do
// seletor, e a comunicação da duração por período (uma vez por período, com o
// dia que a pessoa diz e o aviso de que depois do prazo o 4.2A é NÃO).
//
// O dia da app é fixo (2026-11-17).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));

const copia = (x) => JSON.parse(JSON.stringify(x));

/* um imóvel de arrendamento, um dono, uma inquilina e um contrato declarado de
   habitação permanente
   Recebe: extra (opcional) — campos do contrato (o fisco junta-se ao de omissão).
   Devolve: o contrato guardado em db.contracts. */
function monta(extra) {
  limpar(app);
  const e = Object.assign({}, extra || {});
  const fisco = Object.assign({ estado: 'declarado', finalidade: 'hp', numero: '1234567' }, e.fisco || {});
  delete e.fisco;
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Rui' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'] })];
  app.db.contracts = [app.normContract(Object.assign({ id: 'C1', name: 'Ana · T2', propertyId: 'P1', tenantIds: ['T1'], rent: 1000,
    start: '2024-03-01', end: '2029-02-28', fisco }, e))];
  app.db.transactions = [];
  app.db.recurring = [];
  app.foldState = {};
  return app.db.contracts[0];
}

/* um DOM que só conhece os ids do mapa (o resto não está no ecrã)
   Recebe: valores — {id: valor}; true é uma caixa marcada.
   Devolve: nada — o repor devolve o getElementById do arnês. */
function domCom(valores) {
  app.document.getElementById = (id) => (id in valores
    ? { value: valores[id] === true ? 'on' : String(valores[id]), checked: valores[id] === true, hidden: false, textContent: '', innerHTML: '',
        classList: { add() {}, remove() {} }, addEventListener() {}, focus() {}, scrollIntoView() {}, getAttribute: () => '' }
    : null);
}

/* as janelas e o ecrã ficam de fora: guarda-se o que se abriu, o que se disse e
   os campos que falharam
   Devolve: {abertas: [{t, b, f}], avisos, erros, desfazer} */
function semEcra() {
  const o = { abertas: [], avisos: [], erros: [], desfazer: [] };
  app.openModal = (t, b, f) => { o.abertas.push({ t, b: String(b || ''), f: String(f || '') }); return {}; };
  app.closeModal = () => {};
  app.closeAllModals = () => {};
  app.render = () => {};
  app.buildNav = () => {};
  app.save = () => {};
  app.paintThumbs = () => {};
  app.toast = (m) => { o.avisos.push(String(m)); };
  app.falhaCampo = (id, m) => { o.erros.push(id + ': ' + m); };
  app.comDesfazer = (m, restaurar) => { o.avisos.push(String(m)); o.desfazer.push(restaurar); };
  app.confirmModal = (t, m, fn) => { o.abertas.push({ t, b: String(m), f: '' }); fn(); };
  return o;
}

const ultima = (o) => o.abertas[o.abertas.length - 1];
/* os valores de um sel() desenhado por último com esse id (o registo window.__sel), sem o vazio */
const opcoes = (id) => copia(app.__sel[id].options.map((x) => String(x.v)).filter(Boolean));
/* os motivos que a versão do ano dá a um tipo de benefício, pela ordem dela */
const motivosDa = (ano, para) => copia(app.irsAno(ano).quadro10.motivos.filter((m) => m.para === para).map((m) => m.codigo));

describe('terminar: a data em que acabou e o motivo, e o termo fica (D02, D39, D09)', () => {
  test('terminar a 2026-04-30 um contrato de 2024-03-01 a 2029-02-28 guarda a cessação e não mexe no fim; reativar devolve-o como estava', () => {
    const o = semEcra();
    const c = monta();
    const antes = copia(c);
    assert.equal(app.ctTerminar('C1', '2026-04-30', '01'), '');
    const t = app.contract('C1');
    assert.equal(t.end, '2029-02-28', 'o termo estipulado não muda');
    igual(copia(t.fisco.cessacao), { data: '2026-04-30', motivo: '01' });
    assert.equal(t.active, false);
    assert.equal(app.irsFimReal(t), '2026-04-30');
    assert.ok(o.avisos.includes('Contrato terminado.'));
    app.reactivateContract('C1');
    igual(copia(app.contract('C1')), antes, 'reativar devolve-o como estava');
  });

  test('o «Terminar contrato» abre uma folha com o dia (hoje por omissão, entre o início e o termo) e os motivos da versão', () => {
    const o = semEcra();
    monta();
    app.endContract('C1');
    const f = ultima(o);
    assert.equal(f.t, 'Terminar contrato');
    assert.match(f.b, /Acabou a <span class="req">\*<\/span><input id="c_cesData" type="date" value="2026-11-17" min="2024-03-01" max="2026-11-17"/);
    assert.match(f.b, /Motivo <span class="req">\*<\/span>/);
    assert.match(f.f, /data-click="ctTerminarOk\('C1'\)">Terminar</);
    const codigos = opcoes('c_cesMot');
    assert.deepEqual(codigos, motivosDa(2026, 'reducao'), 'os motivos vêm da versão (quadro10.motivos), não do código');
    for (const m of app.irsAno(2026).quadro10.motivos.filter((x) => x.para === 'reducao')) assert.ok(f.b.includes(m.curto), m.curto);
    assert.equal(app.contract('C1').active, true, 'abrir a folha não grava nada');
    // com o termo passado, o dia proposto é o termo e o motivo o do fim do prazo
    monta({ start: '2021-07-01', end: '2026-06-30' });
    app.endContract('C1');
    assert.match(ultima(o).b, /id="c_cesData" type="date" value="2026-06-30" min="2021-07-01" max="2026-06-30"/);
    assert.match(ultima(o).b, /<input type="hidden" id="c_cesMot" value="03">/);
  });

  test('a folha valida o dia e o motivo, e grava sem tocar no termo', () => {
    const o = semEcra();
    monta();
    domCom({ c_cesData: '2024-02-10', c_cesMot: '02' });
    app.ctTerminarOk('C1');
    assert.match(o.erros.pop(), /^c_cesData: .*01\/03\/2024/, 'nunca antes do início');
    domCom({ c_cesData: '2026-12-01', c_cesMot: '02' });
    app.ctTerminarOk('C1');
    assert.match(o.erros.pop(), /^c_cesData: .*depois de hoje/);
    domCom({ c_cesData: '2026-05-31', c_cesMot: '' });
    app.ctTerminarOk('C1');
    assert.match(o.erros.pop(), /^c_cesMot: /, 'num contrato declarado o motivo é obrigatório');
    domCom({ c_cesData: '2026-05-31', c_cesMot: '99' });
    app.ctTerminarOk('C1');
    assert.match(o.erros.pop(), /^c_cesMot: /, 'só os motivos da versão');
    assert.equal(app.contract('C1').active, true, 'nada se gravou');
    domCom({ c_cesData: '2026-05-31', c_cesMot: '02' });
    app.ctTerminarOk('C1');
    const c = app.contract('C1');
    igual(copia(c.fisco.cessacao), { data: '2026-05-31', motivo: '02' });
    assert.equal(c.end, '2029-02-28');
    assert.equal(c.active, false);
    // depois do termo não: o que continuou depois dele é uma renovação
    monta({ start: '2021-07-01', end: '2026-06-30' });
    assert.match(app.ctTerminar('C1', '2026-08-31', '03'), /30\/06\/2026/);
    assert.equal(app.contract('C1').active, true);
  });

  test('o motivo só é obrigatório no contrato declarado; um contrato por começar não se termina', () => {
    const o = semEcra();
    monta({ fisco: { estado: 'naoDeclarado' } });
    assert.equal(app.ctTerminar('C1', '2026-05-31', ''), '');
    igual(copia(app.contract('C1').fisco.cessacao), { data: '2026-05-31', motivo: '' });
    monta({ start: '2027-01-01', end: '2031-12-31' });
    app.endContract('C1');
    assert.equal(o.abertas.length, 0, 'sem folha');
    assert.match(o.avisos.pop(), /só começa a 01\/01\/2027/);
  });

  test('um contrato isento num programa de arrendamento acessível tem os motivos do programa', () => {
    semEcra();
    monta({ fisco: { isencao: 'paa' } });
    app.endContract('C1');
    const codigos = opcoes('c_cesMot');
    assert.deepEqual(codigos, motivosDa(2026, 'paa'));
    assert.ok(codigos.length > 0);
  });

  test('o anular repõe o contrato', () => {
    const o = semEcra();
    const c = monta();
    const antes = copia(c);
    app.ctTerminar('C1', '2026-05-31', '02');
    o.desfazer.pop()();
    igual(copia(app.contract('C1')), antes);
  });
});

describe('o motivo 01 e o quadro 10 (D10)', () => {
  test('com o motivo do senhorio, a folha diz o n.º 20 e as duas taxas; com outro, que vai ao quadro 10', () => {
    const c = monta({ start: '2024-01-01', end: '2033-12-31', rent: 2500 });
    const t01 = app.ctCessacaoAviso(c, '2026-06-30', '01');
    assert.match(t01, /art\. 72\.º n\.º 20/);
    assert.match(t01, /passam de 10 % para 25 %/, 'a taxa da duração que o contrato chegou a ter');
    assert.match(t01, /declaração de 2026/);
    assert.match(t01, /juros compensatórios/);
    const t02 = app.ctCessacaoAviso(c, '2026-06-30', '02');
    assert.doesNotMatch(t02, /n\.º 20/);
    assert.match(t02, /quadro 10 do Anexo F/);
    assert.equal(app.ctCessacaoAviso(monta({ start: '2025-01-01', end: '2026-12-31' }), '2026-06-30', '01'), '', 'sem redução, nada a regularizar nem quadro 10');
  });

  test('encurtar à mão o fim de um contrato com redução pergunta se é uma correção ou se acabou antes do prazo', () => {
    const o = semEcra();
    monta({ start: '2024-01-01', end: '2028-12-31' });
    app.cForm = app.normContract(copia(app.contract('C1')));
    const campos = { c_rent: '1000', c_start: '2024-01-01', c_end: '2025-08-31', c_active: true };
    domCom(campos);
    app.ctSaver()();
    assert.equal(ultima(o).t, 'Correção ou fim antes do prazo?');
    assert.match(ultima(o).f, /ctFimCurtoResposta\(0\)">É uma correção</);
    assert.match(ultima(o).f, /ctFimCurtoResposta\(1\)">Acabou antes do prazo</);
    assert.equal(app.contract('C1').end, '2028-12-31', 'ainda não gravou');
    app.ctFimCurtoResposta(1);
    assert.equal(ultima(o).t, 'Terminar contrato');
    assert.match(ultima(o).b, /id="c_cesData" type="date" value="2025-08-31"/, 'o dia escrito no fim passa a ser o dia em que acabou');
    assert.match(ultima(o).f, /ctTerminarOk\(''\)/);
    domCom({ c_cesData: '2025-08-31', c_cesMot: '02' });
    app.ctTerminarOk('');
    const c = app.contract('C1');
    assert.equal(c.end, '2028-12-31', 'o termo fica o estipulado');
    igual(copia(c.fisco.cessacao), { data: '2025-08-31', motivo: '02' });
    assert.equal(c.active, false);
    assert.equal(app.irsTaxa(c, 2024).taxa, 15, 'os anos já entregues não mudam de taxa');
    // a correção grava o fim escrito
    monta({ start: '2024-01-01', end: '2028-12-31' });
    app.cForm = app.normContract(copia(app.contract('C1')));
    domCom(campos);
    app.ctSaver()();
    app.ctFimCurtoResposta(0);
    assert.equal(app.contract('C1').end, '2025-08-31');
    igual(copia(app.contract('C1').fisco.cessacao), { data: '', motivo: '' });
  });
});

describe('reativar nunca apaga o termo (D14)', () => {
  test('com o termo passado, reativar é renovar: a renovação fica registada', () => {
    const o = semEcra();
    monta({ start: '2021-01-01', end: '2025-12-31', active: false, fisco: { cessacao: { data: '2025-12-31', motivo: '03' } } });
    app.reactivateContract('C1');
    assert.equal(ultima(o).t, 'Reativar contrato');
    assert.match(ultima(o).f, /ctRenovarOk\('C1',1\)/);
    assert.equal(app.contract('C1').active, false, 'só abre a janela');
    domCom({ c_renfim: '2030-12-31' });
    app.ctRenovarOk('C1', 1);
    const c = app.contract('C1');
    assert.equal(c.active, true);
    assert.equal(c.end, '2030-12-31');
    igual(copia(c.fisco.cessacao), { data: '', motivo: '' });
    assert.deepEqual(copia(c.fisco.renovacoes.map((r) => [r.inicio, r.fim])), [['2026-01-01', '2030-12-31']]);
    assert.equal(app.irsTaxa(c, 2026).motivo === 'base', false, 'a renovação de 5 anos tem redução');
  });

  test('o menu da ficha: um contrato em vigor com o termo passado oferece Renovar e Terminar, e não Reativar', () => {
    semEcra();
    monta({ start: '2021-01-01', end: '2025-12-31' });
    let ficha = null;
    app.abrirFicha = (x) => { ficha = x; };
    app.menu = (id, it) => it.map((x) => x.label);
    app.ctView('C1');
    const rot = ficha.menu();
    assert.ok(rot.includes('Renovar…') && rot.includes('Terminar contrato'));
    assert.ok(!rot.includes('Reativar contrato'));
    app.db.contracts[0].active = false;
    app.ctView('C1');
    assert.ok(ficha.menu().includes('Reativar contrato'));
    monta({ start: '2027-01-01', end: '2031-12-31' });
    app.ctView('C1');
    assert.ok(!ficha.menu().includes('Terminar contrato'), 'por começar não se termina');
  });
});

describe('o formulário do contrato (D42, D43, D33, a cessação)', () => {
  test('o início é obrigatório: o asterisco e o erro junto do campo', () => {
    const o = semEcra();
    monta();
    app.ctModal();
    assert.match(ultima(o).b, /<label>Início <span class="req">\*<\/span><input id="c_start"/);
    app.cForm = app.normContract({ id: 'N1', propertyId: 'P1', tenantIds: ['T1'], rent: 900, start: '' });
    domCom({ c_rent: '900', c_start: '', c_end: '', c_active: true });
    app.ctSaver()();
    assert.match(o.erros.pop(), /^c_start: /);
    assert.equal(app.contract('N1'), undefined, 'não se grava sem início');
  });

  test('uma renovação escrita à mão que passa o fim leva o fim com ela ao gravar', () => {
    semEcra();
    monta({ start: '2021-01-01', end: '2025-12-31' });
    app.cForm = app.normContract(copia(app.contract('C1')));
    app.cForm.fisco.renovacoes = [{ id: 'R1', inicio: '', fim: '' }];
    domCom({ c_rent: '1000', c_start: '2021-01-01', c_end: '2025-12-31', c_active: true, c_rini_R1: '2026-01-01', c_rfim_R1: '2028-12-31' });
    app.ctSaver()();
    const c = app.contract('C1');
    assert.equal(c.end, '2028-12-31');
    assert.equal(app.ctEstado(c), 'ativo');
  });

  test('o seletor do imóvel não oferece os vendidos, salvo o do próprio contrato', () => {
    const o = semEcra();
    monta();
    app.db.properties.push(app.normProp({ id: 'P2', name: 'T1 Benfica', use: 'investimento', ownerIds: ['O1'], vendido: '2026-06-30' }));
    app.ctModal();
    assert.doesNotMatch(ultima(o).b, /T1 Benfica/);
    app.db.properties[0].vendido = '2026-01-31';
    app.db.properties[1].vendido = '';
    app.ctModal();
    assert.equal(app.cForm.propertyId, 'P2', 'o contrato novo abre num imóvel que não foi vendido');
    app.ctModal('C1');
    assert.match(ultima(o).b, /T2 Lisboa/, 'o imóvel do próprio contrato continua lá');
  });

  test('desligar «Contrato em vigor» pede o dia e o motivo; ligar outra vez limpa a cessação', () => {
    const o = semEcra();
    monta();
    app.cForm = app.normContract(copia(app.contract('C1')));
    domCom({ c_rent: '1000', c_start: '2024-03-01', c_end: '2029-02-28' });
    app.ctSaver()();
    assert.equal(ultima(o).t, 'Terminar contrato');
    assert.equal(app.contract('C1').active, true, 'ainda não gravou');
    domCom({ c_cesData: '2026-09-30', c_cesMot: '02' });
    app.ctTerminarOk('');
    igual(copia(app.contract('C1').fisco.cessacao), { data: '2026-09-30', motivo: '02' });
    assert.equal(app.contract('C1').active, false);
    // o formulário de um contrato terminado mostra a cessação, e ligá-lo limpa-a
    app.ctModal('C1');
    assert.match(ultima(o).b, /id="c_cesData" type="date" value="2026-09-30"/);
    assert.match(ultima(o).b, /<input type="hidden" id="c_cesMot" value="02">/);
    domCom({ c_rent: '1000', c_start: '2024-03-01', c_end: '2029-02-28', c_active: true, c_cesData: '2026-09-30', c_cesMot: '02' });
    app.ctSaver()();
    igual(copia(app.contract('C1').fisco.cessacao), { data: '', motivo: '' });
    assert.equal(app.contract('C1').end, '2029-02-28');
  });

  test('o texto livre antigo do motivo deixa de se escrever; fica como nota na ficha', () => {
    semEcra();
    monta({ active: false, fisco: { cessacaoMotivo: 'Acordo', cessacao: { data: '2026-04-30', motivo: '02' } } });
    app.cForm = app.normContract(copia(app.contract('C1')));
    assert.doesNotMatch(app.fiscoSect(), /id="c_fces"/);
    const h = app.ctFicha('C1');
    assert.match(h, /<span>Cessação<\/span><b>30\/04\/2026 · Acabou antes do prazo, por motivo do inquilino<\/b>/);
    assert.match(h, /<span>Nota da cessação<\/span><b>Acordo<\/b>/);
    assert.match(h, /Acabou a 30\/04\/2026, antes do termo\./);
  });
});

describe('o fim e a vida do contrato pelo motor (irsFimEfetivo, irsFimReal)', () => {
  test('ctFimEfetivo é o termo; ctViveNoAno acaba no dia em que o contrato acabou', () => {
    const c = monta({ active: false, fisco: { cessacao: { data: '2025-08-31', motivo: '02' } } });
    assert.equal(app.ctFimEfetivo(c), '2029-02-28');
    assert.equal(app.ctViveNoAno(c, 2025), true);
    assert.equal(app.ctViveNoAno(c, 2026), false, 'depois da cessação já não vive');
  });

  test('a nota da ficha só fala de taxa reduzida quando fica abaixo da base (D11)', () => {
    // quatro anos do regime de 2019: 26 %, acima dos 25 % da base
    monta({ start: '2023-03-01', end: '2027-02-28' });
    const at = /<div class="card ct-sec ct-sec-at">[\s\S]*?<\/div><\/div>(?=<div class="card)/.exec(app.ctFicha('C1'))[0];
    assert.doesNotMatch(at, /taxa reduzida|26 %/);
    assert.doesNotMatch(at, /quadro 4\.2 · pela duração/);
    assert.match(at, /quadro 4\.1/);
  });

  test('o formulário continua sem as isenções que pedem uma confirmação (6H e 6F)', () => {
    monta();
    app.cForm = app.normContract(copia(app.contract('C1')));
    const f = app.fiscoSect();
    assert.match(f, /id="c_fisen"/);
    for (const x of app.irsAno(2026).isencoes.filter((i) => i.pede)) assert.ok(!opcoes('c_fisen').includes(x.id), x.id);
    assert.ok(opcoes('c_fisen').includes('paa'), 'controlo: as outras estão');
  });
});

describe('a comunicação da duração, uma vez por período (D01, D35)', () => {
  test('a ficha propõe a comunicação do período, pela chave do ano do início, e não a do ano dos rendimentos', () => {
    const c = monta();
    assert.equal(app.ctAnoComunicacao(c, '2026-03-01'), 2024, 'o período começou em 2024');
    const h = app.ctFicha('C1');
    assert.match(h, /ctComunicadaPergunta\('C1',2024\)/);
    assert.doesNotMatch(h, /ctComunicadaPergunta\('C1',2025\)|ctComunicadaPergunta\('C1',2026\)/);
    assert.match(h, /A duração do contrato está por comunicar no Portal das Finanças: o prazo era 15\/02\/2025\./);
  });

  test('marcar grava pela chave do período com comunicacoesV=2, e serve todos os anos do período', () => {
    const o = semEcra();
    monta();
    domCom({ c_comdia: '2025-02-10' });
    app.ctMarcarComunicada('C1', 2024, 1);
    const c = app.contract('C1');
    igual(copia(c.fisco.comunicacoes), { 2024: '2025-02-10' });
    assert.equal(c.fisco.comunicacoesV, 2);
    assert.equal(app.irsComunicado(c, 2026), '2025-02-10');
    domCom({});
    const h = app.ctFicha('C1');
    assert.match(h, /A duração do contrato foi comunicada no Portal das Finanças a 10\/02\/2025\./);
    assert.doesNotMatch(h, /por comunicar/);
    assert.ok(o.avisos.includes('Comunicação marcada como feita.'));
    app.ctMarcarComunicada('C1', 2024, 0);
    igual(copia(app.contract('C1').fisco.comunicacoes), {});
  });

  test('uma renovação é outro período: a ficha pede a dela à parte', () => {
    monta({ start: '2021-01-01', end: '2025-12-31', fisco: { comunicacoes: { 2021: '2022-02-01' },
      renovacoes: [{ id: 'R1', inicio: '2026-01-01', fim: '2030-12-31' }] } });
    const h = app.ctFicha('C1');
    assert.match(h, /A renovação de 01\/01\/2026 está por comunicar no Portal das Finanças: até 15\/02\/2027\./);
    assert.match(h, /ctComunicadaPergunta\('C1',2026\)/);
  });

  test('a janela não propõe dia nenhum, e avisa que depois do prazo o 4.2A é NÃO', () => {
    const o = semEcra();
    monta();
    app.ctComunicadaPergunta('C1', 2024);
    const j = ultima(o);
    assert.match(j.b, /<input id="c_comdia" type="date" max="2026-11-17" data-prazo="2025-02-15" data-change="ctComDiaMudou\(\)">/, 'sem value: a pessoa escreve o dia que sabe');
    assert.match(j.b, /<div class="hint" id="c_comdiaFora" hidden>Depois de 15\/02\/2025: no quadro 4\.2A do Anexo F a resposta é NÃO/);
    assert.match(j.f, /ctMarcarComunicada\('C1',2024,1\)/);
    domCom({ c_comdia: '' });
    app.ctMarcarComunicada('C1', 2024, 1);
    assert.match(o.erros.pop(), /^c_comdia: /);
    domCom({ c_comdia: '2025-03-20' });
    app.ctMarcarComunicada('C1', 2024, 1);
    assert.match(o.avisos.pop(), /depois do prazo: no quadro 4\.2A a resposta é NÃO/);
    domCom({});
    assert.match(app.ctFicha('C1'), /comunicada no Portal das Finanças a 20\/03\/2025, depois do prazo \(15\/02\/2025\): no quadro 4\.2A do Anexo F a resposta é NÃO\./);
  });

  test('o aviso da janela acende quando o dia passa o prazo', () => {
    const campo = { value: '2025-03-01', getAttribute: (n) => (n === 'data-prazo' ? '2025-02-15' : '') };
    const aviso = { hidden: true };
    app.document.getElementById = (id) => (id === 'c_comdia' ? campo : id === 'c_comdiaFora' ? aviso : null);
    app.ctComDiaMudou();
    assert.equal(aviso.hidden, false);
    campo.value = '2025-02-10';
    app.ctComDiaMudou();
    assert.equal(aviso.hidden, true);
  });
});

describe('os prazos da AT na ficha e na lista (com a vaga 2 dos prazos)', () => {
  /* um prazo como o prazos.js:prazosDe o dá, com o que o teste quiser */
  const pz = (o) => Object.assign({ chave: o.tipo + ':C1:' + (o.alvo || '2027-02-15'), alvo: '2027-02-15', dias: 90, sub: 'Frase.' }, o);

  test('o toque longo da lista escolhe Terminar ou Reativar pela regra da ficha', () => {
    semEcra();
    let rot = null;
    app.lpShow = (t, o) => { rot = copia(o.map((x) => x.label)); };
    monta({ start: '2021-01-01', end: '2025-12-31' });
    app.lpContrato(['ct', 'C1']);
    assert.ok(rot.includes('Terminar contrato') && !rot.includes('Reativar contrato'), 'em vigor com o termo passado: termina-se');
    app.db.contracts[0].active = false;
    app.lpContrato(['ct', 'C1']);
    assert.ok(rot.includes('Reativar contrato') && !rot.includes('Terminar contrato'));
    monta({ start: '2027-01-01', end: '2031-12-31' });
    app.lpContrato(['ct', 'C1']);
    assert.ok(!rot.includes('Terminar contrato') && !rot.includes('Reativar contrato'), 'por começar: nenhum dos dois');
    assert.ok(rot.includes('Apagar contrato'));
  });

  test('a lista: o registo dos elementos mínimos é do contrato, e o de fevereiro diz o que se comunica', () => {
    assert.ok(app.CT_PRAZOS_DO_CONTRATO.includes('elementos'));
    assert.equal(app.ctTextoDoPrazo(pz({ tipo: 'elementos', chave: 'elementos:C1', dias: 0, semData: true, alvo: '2026-11-17' })), 'Registar no Portal');
    assert.equal(app.ctTextoDoPrazo(pz({ tipo: 'fev15', evento: 'cessacao' })), 'Comunicar a cessação até 15/02');
    assert.equal(app.ctTextoDoPrazo(pz({ tipo: 'fev15', evento: 'cessacao', dias: -3 })), 'Cessação por comunicar');
    assert.equal(app.ctTextoDoPrazo(pz({ tipo: 'fev15', evento: 'renovacao' })), 'Comunicar a renovação até 15/02');
    assert.equal(app.ctTextoDoPrazo(pz({ tipo: 'fev15', evento: 'inicio' })), 'Comunicar a duração até 15/02');
  });

  test('a ficha: o recibo pelo dia em que se recebeu, o registo sem data, e o de fevereiro pelo evento', () => {
    assert.equal(app.ctTituloDoPrazo(pz({ tipo: 'recibos', alvo: '2026-10-08' })), 'Emitir o recibo da renda recebida a 08/10');
    assert.equal(app.ctTituloDoPrazo(pz({ tipo: 'elementos', semData: true })), 'Registar o contrato no Portal das Finanças');
    assert.equal(app.ctTituloDoPrazo(pz({ tipo: 'fev15', evento: 'cessacao' })), 'Comunicar a cessação à AT até 15/02/2027');
    assert.equal(app.ctTituloDoPrazo(pz({ tipo: 'fev15', evento: 'renovacao' })), 'Comunicar a renovação à AT até 15/02/2027');
    assert.equal(app.ctTituloDoPrazo(pz({ tipo: 'fev15', evento: 'inicio' })), 'Comunicar a duração à AT até 15/02/2027');
  });

  test('a ficha mostra o «feito» do prazo (o mesmo do cartão dos prazos), só com a função dele', () => {
    const c = monta();
    const com = app.ctPrazoDaFicha(c, pz({ tipo: 'fev15', evento: 'inicio', acao: "pzComunicadaPergunta('C1','2024')", acaoTexto: 'Marcar como comunicada' }));
    assert.match(com, /data-toca="camada" data-click="pzComunicadaPergunta\(&#0?39;C1&#0?39;,&#0?39;2024&#0?39;\)">Marcar como comunicada<\/button>/);
    assert.match(com, /Ver na ficha/, 'e continua a levar ao cartão da AT');
    const ihru = app.ctPrazoDaFicha(c, pz({ tipo: 'rsaa', acao: "pzIhruPergunta('C1')", acaoTexto: 'Marcar como enviado' }));
    assert.match(ihru, />Marcar como enviado<\/button>/);
    assert.doesNotMatch(app.ctPrazoDaFicha(c, pz({ tipo: 'rsaa', acao: "naoExiste('C1')", acaoTexto: 'Marcar' })), />Marcar<\/button>/, 'sem a função, sem botão');
    assert.doesNotMatch(app.ctPrazoDaFicha(c, pz({ tipo: 'fev15' })), /Marcar como/);
  });

  test('a antecedência da oposição é a do período (prazos.js:pzOposicao), e não 120 dias fixos', () => {
    // seis anos: 240 dias, no topo da ficha
    const seis = monta({ start: '2021-01-01', end: '2026-12-31' });
    const topo = app.ctTopoDaFicha(seis, app.prop('P1'), []);
    assert.match(topo, new RegExp('aviso ao inquilino tem de seguir até <b>' + app.dPT(app.pzAddDias('2026-12-31', -240)) + '</b> \\(240 dias\\)'));
    // dez meses: 60 dias; quatro meses: um terço, arredondado para cima
    assert.match(app.ctFraseDoPrazo({ start: '2026-01-01', end: '2026-10-31', fisco: { finalidade: 'nh' } }), /\(60 dias\)/);
    assert.match(app.ctFraseDoPrazo({ start: '2026-07-01', end: '2026-10-31', fisco: { finalidade: 'nh' } }), /\(41 dias, um terço do prazo\)/);
    // um ano de habitação permanente: a primeira renovação só deixa a oposição valer aos três anos
    assert.match(app.ctFraseDoPrazo({ start: '2026-11-01', end: '2027-10-31', fisco: { finalidade: 'hp' } }),
      /\(120 dias\) — a app lembra-te antes, nos prazos\. Na primeira renovação, a oposição só produz efeitos a 01\/11\/2029\.$/);
  });
});

describe('o inquilino empresa num contrato de habitação (D47)', () => {
  /* o contrato C1 com a inquilina com o NIF dado (o 5… é de pessoa coletiva) */
  const comNif = (nif, fisco) => {
    const c = monta({ fisco: Object.assign({ finalidade: 'hp' }, fisco || {}) });
    app.db.tenants[0].nif = nif;
    return c;
  };
  /* o HTML da caixa da pergunta no bloco fiscal do formulário */
  const caixa = (h) => (/<div id="c_fempBox"[^>]*>/.exec(h) || [''])[0];

  test('a pergunta só se mostra num contrato de habitação com um inquilino de NIF coletivo; escondida não apaga a resposta', () => {
    comNif('503504564');
    app.cForm = app.normContract(copia(app.contract('C1')));
    let f = app.fiscoSect();
    assert.equal(caixa(f), '<div id="c_fempBox">', 'à vista');
    assert.match(f, /<label>O contrato identifica quem lá mora e proíbe a sublocação\?<div class="sel" id="sel_c_femp">/);
    assert.match(f, /<input type="hidden" id="c_femp" value="">/, 'por responder: «Não sei»');
    assert.deepEqual(opcoes('c_femp'), ['1', '0']);
    assert.match(f, /a AT só trata a renda como de habitação se o contrato identifica quem lá mora/);
    // um particular, ou um contrato não habitacional: escondida, com o valor guardado lá dentro
    comNif('123456789', { empresaHabitacao: true });
    app.cForm = app.normContract(copia(app.contract('C1')));
    f = app.fiscoSect();
    assert.equal(caixa(f), '<div id="c_fempBox" hidden>');
    assert.match(f, /<input type="hidden" id="c_femp" value="1">/);
    comNif('503504564', { finalidade: 'nh' });
    app.cForm = app.normContract(copia(app.contract('C1')));
    assert.equal(caixa(app.fiscoSect()), '<div id="c_fempBox" hidden>');
    comNif('503504564', { finalidade: 'hnp' });
    app.cForm = app.normContract(copia(app.contract('C1')));
    assert.equal(caixa(app.fiscoSect()), '<div id="c_fempBox">', 'também na habitação não permanente');
  });

  test('o collectCt grava a resposta em fisco.empresaHabitacao (Sim, Não, Não sei)', () => {
    comNif('503504564');
    app.cForm = app.normContract(copia(app.contract('C1')));
    for (const [v, esperado] of [['1', true], ['0', false], ['', null]]) {
      domCom({ c_rent: '1000', c_femp: v });
      app.collectCt();
      assert.equal(app.cForm.fisco.empresaHabitacao, esperado, v);
    }
    domCom({ c_rent: '1000' });
    app.cForm.fisco.empresaHabitacao = true;
    app.collectCt();
    assert.equal(app.cForm.fisco.empresaHabitacao, true, 'sem o campo no ecrã, não se toca');
  });

  test('o liveNet mostra ou esconde a pergunta quando a finalidade muda', () => {
    comNif('503504564');
    app.cForm = app.normContract(copia(app.contract('C1')));
    const box = { hidden: false };
    const valores = { c_ffin: 'nh', c_rent: '1000' };
    app.document.getElementById = (id) => (id === 'c_fempBox' ? box : id in valores ? { value: valores[id], hidden: false, textContent: '', innerHTML: '' } : null);
    app.liveNet();
    assert.equal(box.hidden, true);
    valores.c_ffin = 'hp';
    app.liveNet();
    assert.equal(box.hidden, false);
  });

  test('a ficha diz a resposta numa linha; por responder, a frase do aviso e «Responder», que abre o formulário na pergunta', () => {
    const o = semEcra();
    comNif('503504564');
    app.db.tenants[0].name = 'Imobiliária Lda';
    let h = app.ctFicha('C1');
    assert.match(h, /<span>Inquilino empresa<\/span><b><span class="badge amber">Por confirmar<\/span><\/b>/);
    assert.match(h, /Arrendamento de habitação a Imobiliária Lda, com NIF de empresa ou de outra entidade\. Confirma se o contrato identifica quem lá mora e proíbe a sublocação/);
    assert.match(h, /data-click="ctResponderEmpresa\('C1'\)">Responder<\/button>/);
    app.ctResponderEmpresa('C1');
    assert.equal(ultima(o).t, 'Editar contrato');
    assert.equal(app.cForm.id, 'C1');
    app.db.contracts[0].fisco.empresaHabitacao = true;
    h = app.ctFicha('C1');
    assert.match(h, /<span>Inquilino empresa<\/span><b>identifica quem lá mora e proíbe a sublocação<\/b>/);
    assert.doesNotMatch(h, /ctResponderEmpresa/);
    app.db.contracts[0].fisco.empresaHabitacao = false;
    assert.match(app.ctFicha('C1'), /<b>não identifica quem lá mora, ou não proíbe a sublocação: para a AT é não habitacional<\/b>/);
    app.db.tenants[0].nif = '123456789';
    assert.doesNotMatch(app.ctFicha('C1'), /Inquilino empresa/, 'um particular: nada');
  });
});
