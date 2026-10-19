// Os formulários do contrato e do movimento, no que o formularios.test.js não
// vê: o acerto, a prestação, a devolução, o mês a que uma renda respeita, as
// partes de uma divisão, os valores que o contrato usa em branco (o nome, o
// imposto, o aumento), o inventário e as chaves, as janelas de nome que o
// movimento abre e o imóvel de quem só colabora. A regra é a de
// testes/lib/formularios.js: o asterisco vermelho nos obrigatórios (os que o
// guardar recusa vazios), o «Opcional» nos outros, e cada exemplo com «Ex: ».

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';
import { conferir, EX } from './lib/formularios.js';

const app = carregarApp();
afterEach(() => repor(app));

// uma base com dois proprietários, uma inquilina e um imóvel de arrendamento dos dois
function base() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Eu' }), app.normPerson({ id: 'O2', name: 'Rui Matos' })];
  app.db.tenants = [app.normPerson({ id: 'I1', name: 'Ana' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1', 'O2'] })];
  return janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
}

/* O placeholder de um campo, lido do HTML pelo id.
   Recebe: html — o corpo do formulário; id — o id do campo.
   Devolve: o texto do placeholder ('' sem ele). */
const ph = (html, id) => {
  const m = new RegExp('id="' + id + '"[^>]*?placeholder="([^"]*)"').exec(html);
  return m ? m[1] : '';
};

// o que os movimentos deixam de fora do conferir: as linhas das divisões e a tabela da hipoteca
const LINHAS = ['t_sp_', 't_pp_', 't_int', 't_cap'];

describe('os movimentos, tipo a tipo', () => {
  test('acerto: quem paga e quem recebe levam o asterisco, como a descrição e o montante', () => {
    const abertas = base();
    app.txModal({ kind: 'settle', propId: 'P1' });
    const html = abertas[0].b;
    conferir('acerto', html, { obrigatorios: ['t_label', 't_amount'], deixados: LINHAS });
    assert.match(html, /Quem paga <span class="req">\*<\/span><div class="sel"/);
    assert.match(html, /Quem recebe <span class="req">\*<\/span><div class="sel"/);
    assert.equal(ph(html, 't_label'), EX + 'Acerto entre proprietários');
    assert.ok(ph(html, 't_amount').startsWith(EX));
  });

  test('prestação: com uma hipoteca viva a hipoteca é obrigatória e leva o asterisco; sem hipoteca não há o campo', () => {
    const abertas = base();
    app.db.properties[0].loans = [app.normLoan({ id: 'L1', name: 'Aquisição', outstanding: 100000, rate: 3, years: 30 }),
      app.normLoan({ id: 'L2', name: 'Obras', outstanding: 20000, rate: 4, years: 10 })];
    app.txModal({ kind: 'loan', propId: 'P1' });
    const html = abertas[0].b;
    conferir('prestação', html, { obrigatorios: ['t_label', 't_amount'], deixados: LINHAS });
    assert.match(html, /Hipoteca <span class="req">\*<\/span><div class="sel"/);
    assert.equal(ph(html, 't_label'), EX + 'Prestação de agosto');
    // sem hipotecas no imóvel, nada a escolher e nada obrigatório
    app.db.properties[0].loans = [];
    app.txModal({ kind: 'loan', propId: 'P1' });
    assert.doesNotMatch(abertas[1].b, /Hipoteca <span class="req">/);
    conferir('prestação sem hipoteca', abertas[1].b, { obrigatorios: ['t_label', 't_amount'], deixados: LINHAS });
  });

  test('devolução: a quem pago é opcional e mostra um nome como exemplo; a descrição traz o exemplo do tipo', () => {
    const abertas = base();
    app.txModal({ kind: 'repay', propId: 'P1' });
    const html = abertas[0].b;
    conferir('devolução', html, { obrigatorios: ['t_label', 't_amount'], exemplos: { t_creditor: EX + 'Pai' }, deixados: LINHAS });
    assert.match(html, /A quem pago \(opcional\)<input id="t_creditor"/);
    assert.equal(ph(html, 't_label'), EX + 'Devolução de parte do empréstimo');
    assert.doesNotMatch(html, /placeholder="[^"]*…"/, 'nenhuma lista de sugestões a fazer de exemplo');
  });

  test('renda: o mês a que respeita diz-se opcional, com o exemplo no formato AAAA-MM, e em branco é o da data; num modelo não aparece', () => {
    const abertas = base();
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', rent: 500, tenantIds: ['I1'], start: '2020-01-01' })];
    app.txModal({ kind: 'income', propId: 'P1', ctId: 'C1' });
    const html = abertas[0].b;
    conferir('renda', html, { obrigatorios: ['t_label', 't_amount'], deixados: LINHAS });
    assert.match(html, /Mês a que respeita \(opcional\)<input id="t_periodo" type="month"[^>]*placeholder="Ex: \d{4}-\d{2}"/);
    assert.match(html, /Mês em branco: o da data\./);
    assert.equal(ph(html, 't_label'), EX + 'Renda de agosto');
    // o modelo guarda a retenção, mas não o mês: o campo não está lá, nem a frase dele
    app.txModal({ kind: 'income', propId: 'P1', ctId: 'C1', modo: 'tpl' });
    const tpl = abertas[1].b;
    conferir('modelo de renda', tpl, { obrigatorios: ['t_label'], exemplos: { t_tplName: EX + 'Renda mensal T2' }, deixados: LINHAS });
    assert.doesNotMatch(tpl, /t_periodo|Mês em branco/);
    assert.match(tpl, /Em branco, o modelo fica com o nome da descrição\./);
  });

  test('divisão entre proprietários: cada parte tem um exemplo da sua unidade, e já não o «0» de antes', () => {
    const esperado = { pct: '1', percent: '50', amount: '100', adjust: '5' };
    for (const mode of Object.keys(esperado)) {
      const abertas = base();
      app.txModal({ kind: 'expense', propId: 'P1', preset: { split: { mode, parts: {} } } });
      const html = abertas[0].b;
      for (const o of ['O1', 'O2']) assert.equal(ph(html, 't_sp_' + o), EX + esperado[mode], mode + ' · ' + o);
      assert.match(html, /id="t_sp_O2"[^>]*aria-label="Parte de Rui Matos"/, 'sem rótulo à vista, o leitor de ecrã sabe de quem é');
      repor(app);
    }
  });

  test('quem só colabora não tem «Sem imóvel»: aí o imóvel é obrigatório e leva o asterisco; o dono não o leva', () => {
    const abertas = base();
    app.txModal({ kind: 'expense' });
    assert.match(abertas[0].b, /<label>Imóvel<div class="sel"/, 'o dono pode registar sem imóvel');
    // um imóvel de outra conta, onde só posso adicionar movimentos
    app.db.properties = [Object.assign(app.normProp({ id: 'P9', name: 'T2 Rui', ownerIds: ['rui'] }), { _sharedFrom: 'Rui', _ownerUserId: 'rui', _cargo: 'Gestor' })];
    app.db.owners = [Object.assign(app.normPerson({ id: 'rui', name: 'Rui' }), { _userId: 'rui' })];
    app.window.CW = { user: { id: 'eu' }, cargos: { P9: { dono: false, nome: 'Gestor', perms: ['tx.view', 'tx.add'] } }, pessoas: {} };
    assert.equal(app.souSoColaborador(), true);
    app.txModal({ kind: 'expense' });
    assert.match(abertas[1].b, /<label>Imóvel <span class="req">\*<\/span><div class="sel"/);
    conferir('despesa de colaborador', abertas[1].b, { obrigatorios: ['t_label', 't_amount'], deixados: LINHAS });
  });

  test('as janelas de nome que o movimento abre (categoria, subcategoria, etiqueta) levam o asterisco e um exemplo do tipo', () => {
    const abertas = base();
    app.txModal({ kind: 'expense', propId: 'P1' });
    app.document.getElementById('t_cat').value = '__new__';
    app.onCatChange();
    let pm = abertas[abertas.length - 1].b;
    assert.match(pm, /Nome <span class="req">\*<\/span><input id="pm_v"[^>]*placeholder="Ex: Obras"/);
    app.document.getElementById('t_sub').value = '__new__';
    app.onSubChange();
    pm = abertas[abertas.length - 1].b;
    assert.match(pm, /placeholder="Ex: Canalização"/);
    app.newTagFromTx();
    pm = abertas[abertas.length - 1].b;
    assert.match(pm, /Nome <span class="req">\*<\/span><input id="pm_v"[^>]*placeholder="Ex: Obras 2026"/);
    // numa receita o exemplo da categoria é de receitas
    app.txModal({ kind: 'income', propId: 'P1' });
    app.document.getElementById('t_cat').value = '__new__';
    app.onCatChange();
    assert.match(abertas[abertas.length - 1].b, /placeholder="Ex: Alojamento local"/);
  });
});

describe('o formulário do movimento no desenho do canvas (M-Novo movimento)', () => {
  /* os botões do segmentado do tipo: [rótulo, ligado]
     Recebe: html — o corpo do formulário.
     Devolve: array de [texto, true/false]. */
  const tipos = (html) => [...html.matchAll(/role="radio" aria-checked="(true|false)"[^>]*data-click="txMudaTipo\('\w+'\)">([^<]*)</g)].map((m) => [m[2], m[1] === 'true']);

  test('o tipo num segmentado de cinco, ligado o do movimento — a dívida paga também liga a «Dívida»', () => {
    const abertas = base();
    app.txModal({ kind: 'expense', propId: 'P1' });
    assert.deepEqual(tipos(abertas[0].b).map((t) => t[0]), ['Receita', 'Despesa', 'Crédito', 'Dívida', 'Transf.']);
    assert.deepEqual(tipos(abertas[0].b).filter((t) => t[1]).map((t) => t[0]), ['Despesa']);
    assert.match(abertas[0].b, /<div class="segm mov-tipo-segm" role="radiogroup" aria-label="Tipo de movimento">/);
    assert.match(abertas[0].b, /aria-label="Transferência entre proprietários"/, 'o «Transf.» diz-se por inteiro ao leitor de ecrã');
    app.txModal({ kind: 'repay', propId: 'P1' });
    assert.deepEqual(tipos(abertas[1].b).filter((t) => t[1]).map((t) => t[0]), ['Dívida']);
  });

  test('o montante grande, na letra dos títulos, com o €, e os campos em grupos', () => {
    const abertas = base();
    app.txModal({ kind: 'expense', propId: 'P1' });
    const html = abertas[0].b;
    assert.match(html, /<span class="mov-montante-campo neg"><input id="t_amount" type="text" inputmode="decimal" class="disp"/);
    assert.match(html, /<span class="disp mov-euro" aria-hidden="true">€<\/span>/);
    assert.ok((html.match(/class="sect mov-grp/g) || []).length >= 3, 'o que foi, a classificação e a divisão');
    assert.match(html, /<div class="mov-par"><label>Data<input id="t_date" type="date"/, 'a data ao lado do imóvel');
    assert.match(html, /<div class="sect mov-grp mov-divisao" id="fold_split">\s*<div class="mov-grp-cab"><b>Divisão entre proprietários<\/b><span class="small">2 donos<\/span><\/div>/);
  });

  test('trocar de tipo no segmentado leva o que só o tipo antigo tinha, e mantém o que se escreveu', () => {
    base();
    app.db.properties[0].loans = [app.normLoan({ id: 'L1', name: 'Aquisição', outstanding: 100000, rate: 3, years: 30 })];
    app.txModal({ kind: 'loan', propId: 'P1' });
    assert.equal(app.tForm.loanId, 'L1');
    app.tForm.interest = 50; app.tForm.principal = 200;
    app.txMudaTipo('expense');
    assert.equal(app.tForm.kind, 'expense');
    assert.equal(app.tForm.loanId, null, 'uma despesa não abate na hipoteca');
    assert.ok(!('interest' in app.tForm) && !('principal' in app.tForm), 'nem leva a distribuição escondida');
    app.tForm.irsCol = 'conservacao';
    app.txMudaTipo('income');
    assert.equal(app.tForm.irsCol, '', 'a coluna do Anexo F é das despesas');
    app.tForm.contractId = 'C1'; app.tForm.retencao = 30; app.tForm.periodo = '2026-03';
    app.txMudaTipo('owed');
    assert.deepEqual([app.tForm.contractId, app.tForm.retencao, app.tForm.periodo], [null, 0, ''], 'o que o IRS pergunta a uma renda sai');
    // o setKind colhe o formulário antes de trocar: o nome escreve-se no campo
    app.document.getElementById('t_creditor').value = 'Pai';
    app.txMudaTipo('owed');
    assert.equal(app.tForm.kind, 'owed', 'a «Dívida» já escolhida fica');
    app.setKind('repay');
    assert.equal(app.tForm.creditor, 'Pai', 'entre recebida e paga não muda nada');
    app.txMudaTipo('settle');
    assert.equal(app.tForm.creditor, '');
    assert.equal(app.tForm.split, null);
  });

  test('um grupo só se divide numa receita ou despesa: noutro tipo volta ao imóvel por omissão', () => {
    base();
    app.db.groups = [app.normGroup({ id: 'G', name: 'Bloco', kind: 'prop', ids: ['P1'] })];
    app.txModal({ kind: 'expense', preset: { groupId: 'G', propertyId: null } });
    assert.equal(app.tForm.groupId, 'G');
    // o setKind colhe o imóvel do formulário antes de trocar: o grupo está escolhido no campo
    app.document.getElementById('t_prop').value = 'g:G';
    app.txMudaTipo('loan');
    assert.deepEqual([app.tForm.groupId, app.tForm.todos, app.tForm.psplit], [null, false, null]);
  });
});

describe('o contrato', () => {
  test('o imóvel e os inquilinos são obrigatórios e levam o asterisco; o nome em branco diz qual fica', () => {
    const abertas = base();
    app.ctModal();
    let html = abertas[0].b;
    assert.match(html, /<label>Imóvel <span class="req">\*<\/span><div class="sel"/);
    assert.match(html, /<div class="flabel">Inquilinos <span class="req">\*<\/span><\/div>/);
    assert.equal(ph(html, 'c_name'), EX + 'Ana · T2 Lisboa', 'sem inquilinos, um exemplo fictício');
    assert.match(html, /Em branco, usa-se o nome dos inquilinos\./);
    // com a inquilina escolhida, o exemplo e a dica dizem o nome que fica
    app.ctModal(null, 'P1', 'I1');
    html = abertas[1].b;
    assert.equal(ph(html, 'c_name'), EX + 'Ana');
    assert.match(html, /Em branco: «Ana», o dos inquilinos\./);
  });

  test('o imposto e o aumento em branco: o exemplo é o valor que se usa, e a dica di-lo', () => {
    const abertas = base();
    app.db.settings.growth = 2.5;
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', rent: 500, tenantIds: ['I1'], start: '2026-01-01', end: '2035-12-31' })];
    app.ctModal('C1');
    const html = abertas[0].b;
    conferir('contrato de dez anos', html, { obrigatorios: ['c_rent'],
      exemplos: { c_name: true, c_tax: EX + '10', c_inc: EX + '2,5', c_iban: true, c_omail: true, c_ophone: true, c_tmail: true, c_tphone: true },
      deixados: ['invn_', 'invq_', 'keyn_', 'keyq_', 'fn_'] });
    assert.match(html, /Em branco: <b id="c_taxVazio">10 %<\/b>, a estimativa para \d{4}\./);
    assert.match(html, /desce na habitação permanente pela duração: 15 % com 5 anos, 10 % com 10 anos, 5 % com 20 anos ou mais/, 'as taxas da duração saem da versão do ano');
    assert.match(html, /Aumento em branco: 2,5 % ao ano nas projeções/);
    assert.equal(ph(html, 'c_rent'), EX + '450');
    assert.equal(ph(html, 'c_iban'), EX + 'PT50 0002 0123 1234 5678 9015 4');
  });

  test('ao mudar as datas, o exemplo do imposto e o «Em branco» acompanham a duração', () => {
    base();
    app.ctModal();
    const el = (id) => app.document.getElementById(id);
    el('c_start').value = '2026-01-01';
    el('c_end').value = '2045-12-31';
    app.liveNet();
    assert.equal(el('c_tax').placeholder, EX + '5', 'vinte anos: 5 %');
    assert.equal(el('c_taxVazio').textContent, '5 %');
    el('c_end').value = '2028-12-31';
    app.liveNet();
    assert.equal(el('c_tax').placeholder, EX + '25');
    assert.equal(el('c_taxVazio').textContent, '25 %');
  });

  test('inventário e chaves: cada linha e cada texto em bloco começa por «Ex: »', () => {
    const abertas = base();
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', rent: 500, tenantIds: ['I1'], start: '2026-01-01',
      inventory: [{ id: 'A1', name: '', qty: 1, state: 'usado' }], keys: [{ id: 'K1', name: '', qty: 1 }] })];
    app.ctModal('C1');
    const html = abertas[0].b;
    assert.equal(ph(html, 'invn_A1'), EX + 'Sofá');
    assert.equal(ph(html, 'invq_A1'), EX + '1');
    assert.equal(ph(html, 'keyn_K1'), EX + 'Chave de casa');
    assert.equal(ph(html, 'keyq_K1'), EX + '1');
    app.addInvBulk();
    assert.match(abertas[1].b, /<textarea id="invbulk"[^>]*placeholder="Ex: Sofá; 1; novo&#10;/);
    app.addKeyBulk();
    assert.match(abertas[2].b, /<textarea id="keybulk"[^>]*placeholder="Ex: Chave de casa; 2&#10;/);
    // a declaração de um contrato que acaba: o motivo é um exemplo, e a lista passa para a dica
    app.cForm.fisco.estado = 'declarado'; app.cForm.end = '2030-01-01';
    const f = app.fiscoSect();
    assert.equal(ph(f, 'c_fces'), EX + 'Fim do prazo');
    assert.match(f, /fim do prazo, acordo, denúncia…<\/div>/);
  });
});

describe('o formulário do contrato no desenho do canvas (M-NovoContrato)', () => {
  test('os campos em grupos, pela ordem da prancheta, e o resto recolhido', () => {
    const abertas = base();
    app.ctModal();
    const html = abertas[0].b;
    const grupos = [...html.matchAll(/<div class="sect ct-gf" id="(ct_\w+)"/g)].map((m) => m[1]);
    assert.deepEqual(grupos, ['ct_arrenda', 'ct_renda', 'ct_prazo', 'ct_fisco', 'ct_contactos', 'ct_notas']);
    assert.deepEqual([...html.matchAll(/<h3 class="ct-gf-tit">([^<]+)<\/h3>/g)].map((m) => m[1]), ['Renda', 'Prazo', 'Contactos']);
    for (const d of ['inv', 'photos', 'keys', 'files']) assert.match(html, new RegExp('<div class="sect fold " id="fold_' + d + '"'), 'a dobra ' + d + ' nasce fechada');
    // os dois interruptores são caixas da casa (o collectCt lê-as como sempre) com o papel de interruptor
    assert.match(html, /<input type="checkbox" role="switch" class="ct-sw" id="c_autorec" checked>/);
    assert.match(html, /<input type="checkbox" role="switch" class="ct-sw" id="c_active" checked>/);
    // o dia do pagamento: dois campos lado a lado, «Opcional»
    assert.match(html, /<label>entre o dia<input id="c_day"[^>]*placeholder="Opcional"><\/label>/);
    assert.match(html, /<label>e o dia<input id="c_dayTo"[^>]*placeholder="Opcional"><\/label>/);
    assert.match(html, /Num mês que não tenha esse dia \(o 31 em abril\), conta o último dia do mês\./, 'o dia que «flutua» diz-se');
  });

  test('o quarto escolhe-se em chips (role radio), e os já prometidos dizem-no sem deixar de se poder escolher', () => {
    const abertas = base();
    app.db.properties[0].rentalMode = 'quartos';
    app.db.properties[0].rooms = [{ id: 'Q1', name: 'Quarto 1' }, { id: 'Q2', name: 'Quarto 2' }];
    app.db.contracts = [app.normContract({ id: 'C9', propertyId: 'P1', roomId: 'Q1', tenantIds: ['I1'], rent: 300, start: '2020-01-01' })];
    app.ctModal(null, 'P1');
    const html = abertas[0].b;
    assert.match(html, /<input type="hidden" id="c_room" value="">/);
    const chips = [...html.matchAll(/role="radio" aria-checked="(true|false)" data-v="([^"]*)"[^>]*>([^<]+)(<span class="ct-ja-txt"> · já arrendado<\/span>)?/g)]
      .map((m) => [m[3], m[1] === 'true', !!m[4]]);
    assert.deepEqual(chips, [['Imóvel inteiro', true, false], ['Quarto 1', false, true], ['Quarto 2', false, false]]);
    assert.doesNotMatch(html, /aria-disabled|disabled/, 'um quarto prometido pode ter o contrato seguinte');
  });

  test('a frase do prazo diz quanto dura e até quando se avisa o inquilino', () => {
    assert.equal(app.ctFraseDoPrazo({ start: '2026-11-01', end: '2027-10-31' }), '1 ano. Para não renovar, avisa o inquilino até 03/07/2027 (120 dias) — a app lembra-te antes, nos prazos.');
    assert.equal(app.ctFraseDoPrazo({ start: '2026-01-01', end: '2026-06-30' }).slice(0, 9), '6 meses. ');
    assert.match(app.ctFraseDoPrazo({ start: '2026-01-01', end: '' }), /^Sem data de fim/);
    assert.equal(app.ctFraseDoPrazo({ start: '2026-05-01', end: '2026-01-01' }), '', 'com as datas trocadas é o erro do campo que fala');
    // e acompanha as datas que se escrevem
    base();
    app.ctModal();
    const el = (id) => app.document.getElementById(id);
    el('c_start').value = '2026-11-01';
    el('c_end').value = '2028-10-31';
    app.liveNet();
    assert.match(el('c_prazoFrase').textContent, /^2 anos\. Para não renovar, avisa o inquilino até 03\/07\/2028/);
  });

  test('os contactos: o contacto copiado de uma pessoa fica com ela escolhida em «Usar o contacto de», e vazio nunca casa com vazio', () => {
    const abertas = base();
    const ultimo = () => abertas[abertas.length - 1].b;
    // a proprietária sem contacto na ficha: nada a escolher, ficam os campos
    app.ctModal();
    assert.equal(app.cForm.ownerContactId, '');
    assert.match(ultimo(), /id="c_omail"/);
    // com contacto: o contrato novo copia-o e escolhe-a — o ecrã já não diz «Outro contacto (escrever)» por cima do contacto dela
    Object.assign(app.db.owners[0], { email: 'eu@exemplo.pt', phone: '913 000 001' });
    app.ctModal();
    assert.deepEqual([app.cForm.ownerContactId, app.cForm.ownerEmail, app.cForm.ownerPhone], ['O1', 'eu@exemplo.pt', '913 000 001']);
    assert.match(ultimo(), /<input type="hidden" id="c_ocid" value="O1">/);
    assert.match(ultimo(), /<div class="ct-net-linha ct-contacto-escolhido"><span>Eu<\/span>/);
    assert.doesNotMatch(ultimo(), /id="c_omail"/);
    // trocar para um imóvel só do Rui: a escolha larga-se com o contacto que veio dela, e entra o do Rui
    Object.assign(app.db.owners[1], { email: 'rui@exemplo.pt', phone: '' });
    app.db.properties.push(app.normProp({ id: 'P2', name: 'T1 Porto', use: 'investimento', ownerIds: ['O2'] }));
    app.cForm.propertyId = 'P2';
    app.fillOwnerContact();
    assert.deepEqual([app.cForm.ownerContactId, app.cForm.ownerEmail, app.cForm.ownerPhone], ['O2', 'rui@exemplo.pt', '']);
    // o que alguém escreveu à mão fica, e não se escolhe ninguém
    Object.assign(app.cForm, { propertyId: 'P1', ownerContactId: '', ownerEmail: 'outro@exemplo.pt', ownerPhone: '960 000 000' });
    app.fillOwnerContact();
    assert.deepEqual([app.cForm.ownerContactId, app.cForm.ownerEmail, app.cForm.ownerPhone], ['', 'outro@exemplo.pt', '960 000 000']);
    // um contrato gravado antes, com o contacto da proprietária escrito (outra caixa, outros espaços): ao abrir, ela fica escolhida
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', rent: 500, tenantIds: ['I1'], start: '2026-01-01', ownerEmail: 'EU@exemplo.pt', ownerPhone: '913000001' })];
    app.ctModal('C1');
    assert.equal(app.cForm.ownerContactId, 'O1');
    // com outro contacto, ninguém
    app.db.contracts[0].ownerPhone = '960 000 000';
    app.ctModal('C1');
    assert.equal(app.cForm.ownerContactId, '');
    assert.match(ultimo(), /id="c_omail"/);
    // sem contacto no contrato nem na ficha: vazio com vazio não é o mesmo contacto
    Object.assign(app.db.owners[0], { email: '', phone: '' });
    Object.assign(app.db.contracts[0], { ownerEmail: '', ownerPhone: '' });
    app.ctModal('C1');
    assert.equal(app.cForm.ownerContactId, '');
    // uma escolha que já não está na lista não se mostra: o sel dizia o nome da primeira pessoa por cima dos campos
    app.db.contracts[0].ownerContactId = 'ninguem';
    app.ctModal('C1');
    assert.match(ultimo(), /<input type="hidden" id="c_ocid" value="">/);
    assert.match(ultimo(), /id="c_omail"/);
    // o inquilino: o mesmo, ao entrar no contrato novo com o contacto da ficha
    Object.assign(app.db.tenants[0], { phone: '912 000 002' });
    app.ctModal(null, 'P1', 'I1');
    assert.deepEqual([app.cForm.tenantContactId, app.cForm.tenantPhone], ['I1', '912 000 002']);
    assert.match(ultimo(), /<input type="hidden" id="c_tcid" value="I1">/);
  });

  test('guardar sem imóvel, sem renda ou sem inquilinos diz o erro junto do campo', () => {
    base();
    app.ctModal(null, 'P1');
    const vistos = [];
    app.falhaCampo = (id, msg) => { vistos.push([id, msg]); };
    const el = (id) => app.document.getElementById(id);
    el('c_prop').value = '';
    app.onSave();
    el('c_prop').value = 'P1';
    el('c_rent').value = '';
    app.onSave();
    el('c_rent').value = '500';
    app.onSave();
    assert.deepEqual(vistos, [['c_prop', 'Escolhe o imóvel.'], ['c_rent', 'Indica a renda mensal.'], ['c_tenants', 'Escolhe pelo menos um inquilino.']]);
    assert.equal(app.db.contracts.length, 0, 'nada se grava');
  });
});
