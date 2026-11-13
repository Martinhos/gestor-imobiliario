// Os movimentos aceitam anexos — imagens e PDF —, como os contratos, as fichas
// das pessoas e as hipotecas (KAN-122, o ticket de QA 209e937f: «Os
// movimentos devem poder aceitar ficheiros. Imagens ou PDF. É recomendado
// inserir uma fatura nas despesas dedutíveis.»).
// - o formulário tem a secção «Anexos» antes dos Comentários, em todos os
//   tipos e nos divididos, e não nos modelos nem nos planeados; numa despesa
//   que conta no Anexo F a dica pede a fatura, nas outras é neutra;
// - o files grava-se no movimento e em cada parte de um lote, e editar o lote
//   mantém a lista igual em todas; os moldes não o levam;
// - a ficha lista-os, e cada um abre;
// - a arrumação do arranque (anexos.js:cleanFiles) não os apaga, o anexo ainda
//   por gravar abre-se do formulário, e apagar o movimento só leva o blob
//   quando o Anular expira;
// - na nuvem, o anexo sobe para a casa do movimento — num dividido, a mesma a
//   que o servidor o prende ao gravar o lote (contra a D1 de teste).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { carregarApp, carregarTudo, limpar, repor, igual } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';
import { conferir } from './lib/formularios.js';
import { ambiente, conta, casa, sync } from './lib/api.js';
import { handleApi } from '../worker/src/api.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));
// a sessão simulada vive no window do contexto, que o repor não toca: sai à parte
afterEach(() => { app.window.CW = undefined; });

const DICA_FATURA = 'Junta a fatura: é o que as Finanças pedem se quiserem ver esta despesa.';
const DICA_NEUTRA = 'Recibos, faturas ou comprovativos, em imagem ou PDF.';
const FATURA = { id: 'F_fatura', name: 'fatura-condominio.pdf', type: 'application/pdf', size: 52000, added: '2026-09-06' };
const FOTO = { id: 'F_foto', name: 'recibo.jpg', type: 'image/jpeg', size: 120000, added: '2026-09-06' };
const LINHAS = ['t_sp_', 't_pp_', 't_int', 't_cap'];
const espera = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function ate(cond, msg, ms = 2000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await cond()) return; await espera(5); }
  assert.fail('não aconteceu: ' + msg);
}

/* Três imóveis meus (comprados em 2015) e eu como dono.
   Devolve: nada — escreve na base. */
function base() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'eu', name: 'Eu' })];
  app.db.properties = ['A', 'B', 'C'].map((id) => app.normProp({ id, name: 'Casa ' + id, ownerIds: ['eu'], purchaseDate: '2015-01-01' }));
}
/* As janelas numa pilha, o que grava e desenha calado, e o toast apanhado.
   Devolve: {abertas, toasts}. */
function ecra() {
  const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
  const toasts = [];
  app.toast = (m) => { toasts.push(m); };
  return { abertas, toasts };
}
/* O corpo da janela de cima: o que o repaintTx lá escreveu, ou o que abriu. */
const corpo = (abertas) => { const L = abertas[abertas.length - 1]; return L.body.innerHTML || L.b; };
const el = (id) => app.document.getElementById(id);
/* Os campos do formulário como a pessoa os deixaria, e o Guardar.
   Recebe: c — {label, amount, date, prop, cat, psplit}. */
function guardar(c) {
  const campos = { t_label: c.label, t_amount: String(c.amount), t_date: c.date || '2026-09-01', t_prop: c.prop,
    t_cat: c.cat || '', t_sub: '', t_irscol: '', t_split: '', t_psplit: c.psplit || '', t_paid: '', t_ct: '', t_loan: '', t_retencao: '' };
  for (const k of Object.keys(campos)) el(k).value = campos[k];
  for (const pid of ['A', 'B', 'C']) el('t_pp_' + pid).value = '';
  app.onSave();
}
/* O apagar dos blobs, apanhado (o idbDel é o que a nuvem embrulha para mandar
   também o DELETE ao servidor). Devolve: os ids apagados, sem miniaturas. */
function apanharApagados(a = app) {
  const ids = [];
  a.idbDel = (id) => { ids.push(id); return Promise.resolve(); };
  return { ids, originais: () => ids.filter((x) => !String(x).startsWith('tn_')) };
}

describe('o formulário do movimento tem os anexos', () => {
  test('numa despesa que conta no Anexo F: «Anexos» antes dos Comentários, imagens e PDF, e a dica da fatura', () => {
    base();
    const { abertas } = ecra();
    app.txModal({ kind: 'expense', propId: 'A', preset: { category: 'Condomínio' } });
    const html = corpo(abertas);
    assert.match(html, /<div class="sect mov-grp mov-anexos" id="t_anexos">/);
    assert.match(html, /<b>Anexos<\/b>/);
    assert.match(html, /<input type="file" id="t_filein" multiple accept="image\/\*,application\/pdf"/, 'aceita imagens e PDF');
    assert.match(html, /data-change="escolherFicheirosDoBloco\(this,'txAddFiles',''\)"/);
    assert.match(html, /data-click="abrirSeletorFicheiros\('t_filein'\)">[\s\S]*?Adicionar ficheiro<\/button>/, 'o botão é o do fileBlock');
    assert.ok(html.includes('<span id="t_anexosDica">' + DICA_FATURA + '</span>'), 'a dica da fatura');
    assert.ok(html.indexOf('id="t_anexos"') < html.indexOf('id="t_notes"'), 'antes dos Comentários');
    assert.ok(html.indexOf('id="fold_cat"') < html.indexOf('id="t_anexos"'), 'depois da classificação');
    conferir('despesa com anexos', html, { obrigatorios: ['t_label', 't_amount'], deixados: LINHAS });
  });

  test('a dica é neutra fora das despesas que contam: não dedutível pela categoria ou pela coluna, receita, crédito, dívida, transferência', () => {
    base();
    const { abertas } = ecra();
    const casos = [
      ['despesa de mobiliário', { kind: 'expense', propId: 'A', preset: { category: 'Mobiliário e equipamento' } }],
      ['despesa com a coluna «Não dedutível»', { kind: 'expense', propId: 'A', preset: { category: 'Condomínio', irsCol: 'nao' } }],
      ['receita', { kind: 'income', propId: 'A' }],
      ['pagamento de crédito', { kind: 'loan', propId: 'A' }],
      ['dívida recebida', { kind: 'owed', propId: 'A' }],
      ['dívida paga', { kind: 'repay', propId: 'A' }],
      ['transferência', { kind: 'settle', propId: 'A' }],
    ];
    for (const [nome, o] of casos) {
      app.txModal(o);
      const html = corpo(abertas);
      assert.match(html, /id="t_filein"/, nome + ': tem o bloco');
      assert.ok(html.includes('<span id="t_anexosDica">' + DICA_NEUTRA + '</span>'), nome + ': a dica neutra');
      assert.ok(!html.includes(DICA_FATURA), nome + ': sem a dica da fatura');
    }
    // uma despesa sem categoria cai em «Outros gastos», que conta
    app.txModal({ kind: 'expense', propId: 'A' });
    assert.ok(corpo(abertas).includes(DICA_FATURA), 'sem categoria: Outros gastos, conta');
  });

  test('nos divididos e no confirmar de um planeado também; nos modelos e nos planeados não', () => {
    base();
    const { abertas } = ecra();
    app.txModal({ kind: 'expense' });
    el('t_prop').value = '*';
    app.onPropChange();
    assert.match(corpo(abertas), /id="fold_psplit"/, 'é um dividido por «Todos os imóveis»');
    assert.match(corpo(abertas), /id="t_filein"/, 'um dividido tem o bloco');
    el('t_prop').value = 'g:G';
    app.db.groups = [app.normGroup({ id: 'G', name: 'Bloco', kind: 'prop', ids: ['A', 'B'] })];
    app.onPropChange();
    assert.match(corpo(abertas), /id="t_filein"/, 'um de grupo também');
    app.txModal({ kind: 'expense', propId: 'A', modo: 'confirmar', recId: 'R1', preset: { label: 'Condomínio', amount: 80 } });
    assert.match(corpo(abertas), /id="t_filein"/, 'confirmar um planeado regista um movimento: pode levar a fatura');
    app.txModal({ kind: 'expense', propId: 'A', modo: 'tpl' });
    assert.doesNotMatch(corpo(abertas), /t_filein|mov-anexos/, 'um modelo não tem anexos');
    app.txModal({ kind: 'expense', propId: 'A', modo: 'tpl', alsoTx: true });
    assert.doesNotMatch(corpo(abertas), /t_filein|mov-anexos/, 'nem o modelo que regista o movimento');
    app.txModal({ kind: 'expense', propId: 'A', modo: 'rec' });
    assert.doesNotMatch(corpo(abertas), /t_filein|mov-anexos/, 'um planeado não tem anexos');
  });

  test('mudar a coluna do Anexo F troca a dica no sítio, e mudar a categoria repinta com a dica nova', () => {
    base();
    const { abertas } = ecra();
    app.txModal({ kind: 'expense', propId: 'A', preset: { category: 'Condomínio' } });
    el('t_cat').value = 'Condomínio';
    el('t_irscol').value = 'nao';
    app.onIrsCol();
    assert.equal(el('t_anexosDica').textContent, DICA_NEUTRA);
    el('t_irscol').value = 'condominio';
    app.onIrsCol();
    assert.equal(el('t_anexosDica').textContent, DICA_FATURA);
    el('t_irscol').value = '';
    el('t_cat').value = 'Mobiliário e equipamento';
    app.onCatChange();
    assert.ok(corpo(abertas).includes(DICA_NEUTRA), 'a categoria repinta o formulário inteiro');
  });

  test('só com «Adicionar fotos e documentos» no imóvel: sem ela não há bloco, e os anexos que lá estão ficam', () => {
    base();
    const { abertas } = ecra();
    app.window.CW = { user: { id: 'eu' }, cargos: { A: { dono: false, nome: 'Contabilista', perms: ['tx.view', 'tx.add', 'file.view'] } }, pessoas: {} };
    app.txModal({ kind: 'expense', propId: 'A' });
    assert.doesNotMatch(corpo(abertas), /t_filein|mov-anexos/, 'sem file.add não se juntam anexos');
    app.db.transactions = [app.normTx({ id: 'T1', kind: 'expense', label: 'Obras', amount: 300, date: '2026-09-01', propertyId: 'A', files: [FATURA] })];
    app.txModal({ id: 'T1' });
    guardar({ label: 'Obras na cozinha', amount: 300, prop: 'A' });
    igual(app.db.transactions[0].files, [FATURA], 'editar sem file.add não tira o anexo');
    app.window.CW.cargos.A.perms.push('file.add');
    app.txModal({ kind: 'expense', propId: 'A' });
    assert.match(corpo(abertas), /id="t_filein"/, 'com file.add, sim');
  });
});

describe('os anexos gravam-se com o movimento', () => {
  test('num imóvel: adicionar pelo formulário, gravar, e remover apaga o ficheiro', async () => {
    base();
    const { abertas, toasts } = ecra();
    app.txModal({ kind: 'expense', propId: 'A' });
    app.takeFiles = () => Promise.resolve([FATURA, FOTO]);
    await app.txAddFiles({});
    igual(app.tForm.files, [FATURA, FOTO]);
    assert.ok(toasts.includes('2 anexos adicionados.'), toasts.join(' / '));
    guardar({ label: 'Condomínio de setembro', amount: 80, prop: 'A', cat: 'Condomínio' });
    assert.equal(app.db.transactions.length, 1);
    igual(app.db.transactions[0].files, [FATURA, FOTO]);
    // editar: o anexo está no formulário, e remover leva-o
    const apagados = apanharApagados();
    app.txModal({ id: app.db.transactions[0].id });
    igual(app.tForm.files, [FATURA, FOTO]);
    assert.match(corpo(abertas), /fatura-condominio\.pdf[\s\S]*recibo\.jpg/, 'os dois na lista do bloco');
    app.txDelFile('F_foto');
    igual(apagados.originais(), ['F_foto'], 'o ficheiro sai já, como no contrato');
    guardar({ label: 'Condomínio de setembro', amount: 80, prop: 'A', cat: 'Condomínio' });
    igual(app.db.transactions[0].files, [FATURA]);
  });

  test('num dividido por «Todos os imóveis»: a mesma lista em cada parte; editar o lote mantém-na igual em todas', async () => {
    base();
    ecra();
    app.txModal({ kind: 'expense' });
    el('t_prop').value = '*';
    app.onPropChange();
    app.takeFiles = () => Promise.resolve([FATURA]);
    await app.txAddFiles({});
    guardar({ label: 'Seguro', amount: 300, prop: '*', psplit: 'equal' });
    const partes = () => app.db.transactions.filter((t) => t.lote);
    assert.equal(partes().length, 3);
    for (const t of partes()) igual(t.files, [FATURA], 'a parte de ' + t.propertyId);
    // editar o lote: o formulário traz os anexos, e trocar um por outro muda em todas
    apanharApagados();
    app.txModal({ id: partes()[1].id });
    igual(app.tForm.files, [FATURA], 'o lote abre com os anexos');
    app.txDelFile('F_fatura');
    app.takeFiles = () => Promise.resolve([FOTO]);
    await app.txAddFiles({});
    guardar({ label: 'Seguro', amount: 300, prop: '*', psplit: 'equal' });
    assert.equal(partes().length, 3);
    for (const t of partes()) igual(t.files, [FOTO], 'a parte de ' + t.propertyId + ' depois de editar');
    // passar o lote a um imóvel só: o movimento que fica leva os anexos
    app.txModal({ id: partes()[0].id });
    guardar({ label: 'Seguro', amount: 300, prop: 'B' });
    assert.equal(partes().length, 0);
    assert.equal(app.db.transactions.length, 1);
    igual(app.db.transactions[0].files, [FOTO]);
  });

  test('os moldes não levam anexos: um planeado, um modelo e o movimento que deles nasce; aplicar um modelo a um movimento aberto não os perde', () => {
    base();
    ecra();
    assert.ok(!app.TX_TPL_KEYS.includes('files'), 'uma fatura é de um movimento, não de um molde');
    const tx = app.normTx({ kind: 'expense', label: 'Condomínio', amount: 80, propertyId: 'A', files: [FATURA] });
    assert.equal('files' in app.txSnapshot(tx), false);
    assert.equal('files' in app.normRec({ name: 'Condomínio', next: '2026-10-01', tx }).tx, false, 'o planeado');
    assert.equal('files' in app.normTpl({ name: 'Condomínio', tx }).tx, false, 'o modelo');
    // confirmar um planeado: o movimento nasce do tx do planeado, sem anexos
    const r = app.normRec({ id: 'R1', name: 'Condomínio', next: '2026-09-01', tx });
    app.db.recurring = [r];
    app.txModal({ kind: 'expense', propId: 'A', modo: 'confirmar', recId: 'R1', preset: JSON.parse(JSON.stringify(r.tx)) });
    assert.equal(app.tForm.files, undefined, 'confirmar começa sem anexos (juntam-se ali ou depois)');
    // aplicar um modelo a um movimento aberto: a fatura dele fica
    app.db.transactions = [app.normTx({ id: 'T1', kind: 'expense', label: 'Obras', amount: 300, date: '2026-09-01', propertyId: 'A', files: [FATURA] })];
    app.txModal({ id: 'T1' });
    app.applyTemplate({ tx: { kind: 'expense', label: 'Seguro', amount: 50, propertyId: 'A' } });
    igual(app.tForm.files, [FATURA]);
    assert.equal(app.tForm.label, 'Seguro', 'o modelo aplicou-se');
  });

  test('normTx: os anexos normalizam-se quando os há, e um movimento sem eles não ganha o campo', () => {
    assert.equal('files' in app.normTx({ kind: 'expense', amount: 5 }), false, 'os movimentos de antes não mudam (nem sobem por isso)');
    const t = app.normTx({ kind: 'expense', amount: 5, files: [{ id: "F'1", name: 'a.pdf' }] });
    assert.match(t.files[0].id, /^[A-Za-z0-9_-]+$/, 'o id pelo idSeguro');
    assert.equal(t.files[0].type, '');
    igual(app.normTx({ kind: 'expense', amount: 5, files: 'lixo' }).files, []);
    igual(app.normTx({ kind: 'expense', amount: 5, files: [] }).files, [], 'remover todos deixa a lista vazia (a fusão a três vê a remoção)');
  });

  test('uma cópia em JSON com anexos num movimento repõe-se, e os anexos ficam na lista do que deve existir', () => {
    base();
    ecra();
    app.confirmModal = (t, x, cb) => cb();
    app.applyTheme = () => {};
    const copia = { properties: [{ id: 'A', name: 'Casa A' }], transactions: [{ id: 'T1', kind: 'expense', label: 'Obras', amount: 300, date: '2026-09-01', propertyId: 'A', files: [FATURA] }] };
    app.bkLoad(JSON.stringify(copia));
    igual(app.db.transactions[0].files, [FATURA]);
    assert.ok(app.allFileMetas().some((f) => f.id === 'F_fatura'));
  });
});

describe('a ficha do movimento', () => {
  test('lista os anexos, e cada um abre; sem anexos não há bloco', () => {
    base();
    app.db.transactions = [
      app.normTx({ id: 'T1', kind: 'expense', label: 'Obras', amount: 300, date: '2026-09-01', propertyId: 'A', files: [FATURA, FOTO] }),
      app.normTx({ id: 'T2', kind: 'expense', label: 'Luz', amount: 30, date: '2026-09-01', propertyId: 'A' }),
    ];
    const f = app.txFicha('T1');
    assert.match(f, /<div class="flabel">Anexos<\/div><div class="ct-lista-anexos mov-anexos-lista">/);
    assert.match(f, /<button type="button" class="ct-anexo" data-toca="camada" data-click="openMeta\('F_fatura'\)">[\s\S]*?<span>fatura-condominio\.pdf<\/span>/);
    assert.match(f, /data-click="openMeta\('F_foto'\)">[\s\S]*?<span>recibo\.jpg<\/span>/);
    assert.doesNotMatch(f, /<(input|textarea|select)\b/, 'uma ficha lê-se: sem campos');
    assert.doesNotMatch(app.txFicha('T2'), /Anexos/);
    // tocar abre o ficheiro: o openMeta encontra-o na base
    let aberto = null;
    app.openFileMeta = (m) => { aberto = m; };
    app.openMeta('F_foto');
    assert.equal(aberto && aberto.id, 'F_foto');
  });

  test('a ficha de uma parte de um lote mostra os anexos do lote; sem «Ver fotos e documentos» não os mostra', () => {
    base();
    const lote = { id: 'L', n: 3, total: 300, alvo: 'todos', modo: 'equal', partes: {} };
    app.db.transactions = ['A', 'B', 'C'].map((p) => app.normTx({ id: 'L_' + p, kind: 'expense', label: 'Seguro', amount: 100, date: '2026-09-01', propertyId: p, lote, files: [FATURA] }));
    assert.match(app.txFicha('L_B'), /openMeta\('F_fatura'\)/);
    app.window.CW = { user: { id: 'eu' }, cargos: { A: { dono: false, nome: 'Contas', perms: ['tx.view'] } }, pessoas: {} };
    assert.doesNotMatch(app.txFicha('L_A'), /Anexos/, 'o servidor não lhe dava o ficheiro');
  });
});

describe('a arrumação e o apagar', () => {
  test('allFileMetas conhece os anexos dos movimentos, e o arranque não os apaga (cleanFiles)', async () => {
    base();
    app.db.transactions = [app.normTx({ id: 'T1', kind: 'expense', label: 'Obras', amount: 300, date: '2026-09-01', propertyId: 'A', files: [FATURA] })];
    assert.ok(app.allFileMetas().some((f) => f.id === 'F_fatura'), 'na lista do que deve existir');
    const chaves = ['F_fatura', 'tn_F_fatura', 'F_lixo', 'tn_F_lixo'], saiu = [];
    const loja = { getAllKeys() { const r = { result: chaves }; setTimeout(() => r.onsuccess(), 0); return r; }, delete(k) { saiu.push(k); } };
    app.idb = () => Promise.resolve({ transaction: () => { const t = { objectStore: () => loja }; setTimeout(() => t.oncomplete && t.oncomplete(), 0); return t; } });
    app.cleanFiles();
    await ate(() => saiu.length >= 2, 'arrumou');
    await espera(20);
    assert.deepEqual(saiu.sort(), ['F_lixo', 'tn_F_lixo'], 'só o que nada refere');
    // as partes de um lote referem o mesmo ficheiro: entra uma vez
    const lote = { id: 'L', n: 3, total: 300, alvo: 'todos', modo: 'equal', partes: {} };
    app.db.transactions = ['A', 'B', 'C'].map((p) => app.normTx({ id: 'L_' + p, kind: 'expense', label: 'Seguro', amount: 100, date: '2026-09-01', propertyId: p, lote, files: [FATURA] }));
    assert.equal(app.allFileMetas().filter((f) => f.id === 'F_fatura').length, 1);
  });

  test('um anexo ainda por gravar abre-se do formulário (pendingMetas)', async () => {
    base();
    ecra();
    app.txModal({ kind: 'expense', propId: 'A' });
    app.takeFiles = () => Promise.resolve([FOTO]);
    await app.txAddFiles({});
    assert.ok(app.pendingMetas().some((f) => f.id === 'F_foto'));
    let aberto = null;
    app.openFileMeta = (m) => { aberto = m; };
    app.openMeta('F_foto');
    assert.equal(aberto && aberto.name, 'recibo.jpg');
  });

  test('apagar um movimento: o ficheiro só sai quando o Anular expira, e o Anular devolve-o com ele', () => {
    base();
    ecra();
    const apagados = apanharApagados();
    let ultimo = null;
    app.comDesfazer = (m, restaurar, aoExpirar) => { ultimo = { m, restaurar, aoExpirar }; };
    app.db.transactions = [app.normTx({ id: 'T1', kind: 'expense', label: 'Obras', amount: 300, date: '2026-09-01', propertyId: 'A', files: [FATURA] })];
    app.delTx('T1');
    assert.equal(app.db.transactions.length, 0);
    assert.equal(apagados.ids.length, 0, 'nada sai antes do prazo');
    ultimo.restaurar();
    igual(app.db.transactions[0].files, [FATURA], 'o Anular devolve-o com o anexo');
    app.delTx('T1');
    ultimo.aoExpirar();
    igual(apagados.originais(), ['F_fatura'], 'expirou: o ficheiro sai');
  });

  test('apagar um lote leva o ficheiro uma vez; um ficheiro que outro registo ainda refere fica', () => {
    base();
    ecra();
    const apagados = apanharApagados();
    let ultimo = null;
    app.comDesfazer = (m, restaurar, aoExpirar) => { ultimo = { m, restaurar, aoExpirar }; };
    const lote = { id: 'L', n: 3, total: 300, alvo: 'todos', modo: 'equal', partes: {} };
    app.db.transactions = ['A', 'B', 'C'].map((p) => app.normTx({ id: 'L_' + p, kind: 'expense', label: 'Seguro', amount: 100, date: '2026-09-01', propertyId: p, lote, files: [FATURA] }));
    app.delTx('L_B');
    assert.equal(app.db.transactions.length, 0, 'as partes todas');
    ultimo.aoExpirar();
    igual(apagados.originais(), ['F_fatura'], 'uma vez');
    // dois registos com o mesmo anexo (uma cópia importada, um contrato): apagar um não o leva
    apagados.ids.length = 0;
    app.db.transactions = [
      app.normTx({ id: 'T1', kind: 'expense', label: 'Obras', amount: 300, date: '2026-09-01', propertyId: 'A', files: [FATURA] }),
      app.normTx({ id: 'T2', kind: 'expense', label: 'Obras (cópia)', amount: 300, date: '2026-09-01', propertyId: 'B', files: [FATURA] }),
    ];
    app.delTx('T1');
    ultimo.aoExpirar();
    igual(apagados.ids, [], 'o T2 ainda o refere');
  });
});

/* ------------------------------------------------------------- na nuvem */

/* O elemento e o body falsos da seleção (como o testes/selecao-movimentos.test.js). */
function elemento() {
  const e = { attrs: {}, innerHTML: '', className: '', removido: false };
  const cs = () => e.className.split(/\s+/).filter(Boolean);
  e.classList = {
    contains: (c) => cs().includes(c),
    add: (c) => { if (!cs().includes(c)) e.className = cs().concat(c).join(' '); },
    remove: (c) => { e.className = cs().filter((x) => x !== c).join(' '); },
    toggle: (c, on) => { if (on === undefined ? !cs().includes(c) : on) e.classList.add(c); else e.classList.remove(c); },
  };
  e.setAttribute = (k, v) => { e.attrs[k] = String(v); };
  e.getAttribute = (k) => (k in e.attrs ? e.attrs[k] : null);
  e.removeAttribute = (k) => { delete e.attrs[k]; };
  e.remove = () => { e.removido = true; };
  e.addEventListener = () => {};
  return e;
}

describe('na nuvem', () => {
  const nv = carregarTudo({ hoje: '2026-09-06' });
  afterEach(() => repor(nv));

  test('casaDoAnexo: a casa do movimento; sem imóvel, nenhuma; de um imóvel que já não está, nenhuma', () => {
    limpar(nv);
    nv.db.properties = ['H1', 'H2'].map((id) => nv.normProp({ id, name: id }));
    nv.db.transactions = [
      nv.normTx({ id: 'T1', kind: 'expense', label: 'Obras', amount: 300, date: '2026-09-01', propertyId: 'H2', files: [FATURA] }),
      nv.normTx({ id: 'T2', kind: 'expense', label: 'Contabilista', amount: 50, date: '2026-09-01', files: [FOTO] }),
      nv.normTx({ id: 'T3', kind: 'expense', label: 'Velho', amount: 5, date: '2026-09-01', propertyId: 'HX', files: [{ id: 'F_velho', name: 'v.pdf' }] }),
    ];
    assert.equal(nv.casaDoAnexo('F_fatura'), 'H2');
    assert.equal(nv.casaDoAnexo('F_foto'), null, 'sem imóvel o anexo sobe solto: só quem o carregou o vê');
    assert.equal(nv.casaDoAnexo('F_velho'), null);
    assert.ok(nv.allFileMetas().some((f) => f.id === 'F_foto'), 'mas continua na lista do que deve existir');
  });

  test('num dividido, o anexo sobe para a casa a que o servidor o prende ao gravar o lote, e o PUT de cada sessão não o muda', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    for (const h of ['H1', 'H2', 'H3']) await casa(env, D, h);
    limpar(nv);
    nv.CW.user = { id: D.id, token: D.token, name: 'Dona' };
    try {
      nv.db.owners = [nv.normPerson({ id: D.id, name: 'Dona' })];
      nv.db.properties = ['H1', 'H2', 'H3'].map((id) => nv.normProp({ id, name: id, ownerIds: [D.id] }));
      nv.db.groups = [nv.normGroup({ id: 'G', name: 'Todas', kind: 'prop', ids: ['H1', 'H2', 'H3'] })];
      const r =nv.partirMovimento(nv.normTx({ id: 'LOTE1', kind: 'expense', label: 'Seguro', amount: 90, date: '2026-09-01', groupId: 'G', psplit: { mode: 'equal', parts: {} }, files: [FATURA] }));
      assert.equal(r.erro, undefined, r.erro);
      // as partes na base por outra ordem: quem manda é a ordem dos imóveis
      nv.db.transactions = r.partes.slice().reverse();
      assert.equal(nv.db.transactions.length, 3);
      // o anexo subiu solto (escolhido antes de gravar)
      const put = (casaId) => handleApi(new Request('https://app.x.pt/api/files/F_fatura' + (casaId ? '?casa=' + casaId : ''), {
        method: 'PUT', body: new Uint8Array(900),
        headers: { Authorization: 'Bearer ' + D.token, 'X-Ficheiro-Tipo': 'application/pdf', 'X-Ficheiro-Nome': 'fatura.pdf' },
      }), env, { waitUntil() {} });
      assert.equal((await put()).status, 200);
      // a gravação sobe como o pushNow a manda: pela ordem do exportEntities
      const map = nv.exportEntities();
      const ops = Object.keys(map).filter((k) => map[k].kind === 'tx').map((k) => Object.assign({ op: 'put' }, map[k]));
      assert.equal(ops.length, 3);
      const res = await sync(env, D, ops);
      assert.ok(res.every((x) => x.ok), JSON.stringify(res));
      const linha = () => env.DB.prepare("SELECT house_id, record_kind, record_id FROM files WHERE id = 'F_fatura'").first();
      const depois = await linha();
      assert.equal(depois.record_kind, 'tx');
      assert.equal(nv.casaDoAnexo('F_fatura'), depois.house_id, 'a mesma casa que o servidor prendeu');
      assert.equal(depois.house_id, 'H3', 'a da última parte pela ordem dos imóveis');
      assert.equal(depois.record_id, nv.parteId('LOTE1', 'H3'));
      // a sessão seguinte sobe-o outra vez com a casa que o casaDoAnexo diz: fica onde está
      assert.equal((await put(nv.casaDoAnexo('F_fatura'))).status, 200);
      assert.deepEqual({ ...(await linha()) }, { ...depois }, 'a mesma casa, presa à mesma parte');
    } finally { nv.CW.user = null; }
  });

  test('apagar na seleção dos Movimentos: o ficheiro sai quando o Anular expira', () => {
    limpar(nv);
    const doc = nv.document, postas = [], body = elemento();
    body.appendChild = (x) => { postas.push(x); return x; };
    doc.body = body;
    doc.createElement = () => elemento();
    doc.querySelector = (s) => (s === '.sel-fundo' ? postas.filter((x) => !x.removido).pop() || null : null);
    nv.db.transactions = [
      nv.normTx({ id: 'A', kind: 'expense', label: 'Obras', amount: 300, date: '2026-09-01', files: [FATURA] }),
      nv.normTx({ id: 'B', kind: 'income', label: 'Renda', amount: 500, date: '2026-09-02' }),
    ];
    nv.tab = 'transactions';
    nv.CW.selReset();
    let conf = null, ultimo = null;
    nv.confirmModal = (t, x, cb) => { conf = cb; };
    nv.comDesfazer = (m, restaurar, aoExpirar) => { ultimo = { m, restaurar, aoExpirar }; };
    nv.save = () => {};
    const apagados = apanharApagados(nv);
    nv.CW.selEntrar('A');
    nv.CW.selApagar();
    conf();
    assert.equal(nv.db.transactions.length, 1);
    assert.equal(apagados.ids.length, 0);
    assert.equal(typeof ultimo.aoExpirar, 'function', 'o apagar da seleção liquida os anexos no fim do prazo');
    ultimo.aoExpirar();
    igual(apagados.originais(), ['F_fatura']);
  });
});
