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
    conferir('modelo de renda', tpl, { obrigatorios: ['t_label', 't_amount'], exemplos: { t_tplName: EX + 'Renda mensal T2' }, deixados: LINHAS });
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
